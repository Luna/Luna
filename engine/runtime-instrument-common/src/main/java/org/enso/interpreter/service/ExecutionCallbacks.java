package org.enso.interpreter.service;

import com.oracle.truffle.api.CompilerDirectives;
import com.oracle.truffle.api.frame.MaterializedFrame;
import com.oracle.truffle.api.interop.TruffleObject;
import com.oracle.truffle.api.nodes.Node;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import org.enso.interpreter.instrument.MethodCallsCache;
import org.enso.interpreter.instrument.RuntimeCache;
import org.enso.interpreter.instrument.UpdatesSynchronizationState;
import org.enso.interpreter.instrument.Visualization;
import org.enso.interpreter.instrument.VisualizationHolder;
import org.enso.interpreter.instrument.profiling.ExecutionTime;
import org.enso.interpreter.instrument.profiling.ProfilingInfo;
import org.enso.interpreter.node.EnsoRootNode;
import org.enso.interpreter.node.callable.FunctionCallInstrumentationNode;
import org.enso.interpreter.node.expression.builtin.meta.TypeOfNode;
import org.enso.interpreter.node.expression.debug.EvalNode;
import org.enso.interpreter.runtime.EnsoContext;
import org.enso.interpreter.runtime.callable.CallerInfo;
import org.enso.interpreter.runtime.callable.UnresolvedSymbol;
import org.enso.interpreter.runtime.data.Type;
import org.enso.interpreter.runtime.data.text.Text;
import org.enso.interpreter.runtime.state.State;
import org.enso.interpreter.runtime.type.Constants;
import org.enso.interpreter.service.ExecutionService.ExpressionCall;
import org.enso.interpreter.service.ExecutionService.ExpressionValue;
import org.enso.interpreter.service.ExecutionService.FunctionCallInfo;
import org.enso.polyglot.debugger.ExecutedVisualization;
import org.enso.polyglot.debugger.IdExecutionService;
import scala.collection.Iterator;

final class ExecutionCallbacks
    implements IdExecutionService.Callbacks, IdExecutionService.ExecutionSupport {

  private final VisualizationHolder visualizationHolder;
  private final UUID nextExecutionItem;
  private final RuntimeCache cache;
  private final MethodCallsCache methodCallsCache;
  private final UpdatesSynchronizationState syncState;
  private final Map<UUID, FunctionCallInfo> calls = new HashMap<>();
  private final Consumer<ExpressionValue> onCachedCallback;
  private final Consumer<ExpressionValue> onComputedCallback;
  private final Consumer<ExpressionCall> functionCallCallback;
  private final Consumer<ExecutedVisualization> onExecutedVisualizationCallback;
  private final EvalNode evalNode = EvalNode.build();

  /**
   * Creates callbacks instance.
   *
   * @param cache the precomputed expression values.
   * @param methodCallsCache the storage tracking the executed updateCachedResult calls.
   * @param syncState the synchronization state of runtime updates.
   * @param nextExecutionItem the next item scheduled for execution.
   * @param functionCallCallback the consumer of function call events.
   * @param onComputedCallback the consumer of the computed value events.
   * @param onCachedCallback the consumer of the cached value events.
   */
  ExecutionCallbacks(
      VisualizationHolder visualizationHolder,
      UUID nextExecutionItem,
      RuntimeCache cache,
      MethodCallsCache methodCallsCache,
      UpdatesSynchronizationState syncState,
      Consumer<ExpressionValue> onCachedCallback,
      Consumer<ExpressionValue> onComputedCallback,
      Consumer<ExpressionCall> functionCallCallback,
      Consumer<ExecutedVisualization> onExecutedVisualizationCallback) {
    this.visualizationHolder = visualizationHolder;
    this.nextExecutionItem = nextExecutionItem;
    this.cache = cache;
    this.methodCallsCache = methodCallsCache;
    this.syncState = syncState;
    this.onCachedCallback = onCachedCallback;
    this.onComputedCallback = onComputedCallback;
    this.functionCallCallback = functionCallCallback;
    this.onExecutedVisualizationCallback = onExecutedVisualizationCallback;
  }

  @Override
  public void onEnter(UUID nodeId) {}

  @Override
  public void onExpressionReturn(UUID nodeId, Object result, long nanoElapsedTime) {}

  @CompilerDirectives.TruffleBoundary
  public Object onFunctionReturn(UUID nodeId, TruffleObject result) {
    var fnCall = (FunctionCallInstrumentationNode.FunctionCall) result;
    calls.put(nodeId, FunctionCallInfo.fromFunctionCall(fnCall));
    functionCallCallback.accept(new ExpressionCall(nodeId, fnCall));
    // Return cached value after capturing the enterable function call in `functionCallCallback`
    Object cachedResult = cache.get(nodeId);
    if (cachedResult != null) {
      return cachedResult;
    }
    methodCallsCache.setExecuted(nodeId);
    return null;
  }

  public Object findCachedResult(Object materializedFrame, Object node, UUID nodeId) {
    Object result = getCachedResult(nodeId);

    Iterator<Visualization> visualizations = findVisualizations(nodeId);
    while (visualizations.hasNext()) {
      Visualization visualization = visualizations.next();

      if (visualization instanceof Visualization.OneshotExpression oneshotExpression) {
        EnsoRootNode ensoRootNode = ((EnsoRootNode) ((Node) node).getRootNode());
        CallerInfo callerInfo =
            new CallerInfo(
                ((MaterializedFrame) materializedFrame),
                ensoRootNode.getLocalScope(),
                ensoRootNode.getModuleScope());

        Object visualizationResult = null;
        Throwable visualizationError = null;
        try {
          visualizationResult =
              evalNode.execute(
                  callerInfo,
                  State.create(EnsoContext.get(null)),
                  Text.create(oneshotExpression.expression()));
        } catch (Exception exception) {
          visualizationError = exception;
        }

        ExecutedVisualization executedVisualization =
            new ExecutedVisualization(
                visualizationResult, visualizationError, visualization.id(), nodeId, result);
        callOnExecutedVisualizationCallback(executedVisualization);
      }
    }

    // When executing the call stack we need to capture the FunctionCall of the next (top) stack
    // item in the `functionCallCallback`. We allow to execute the cached `stackTop` value to be
    // able to continue the stack execution, and unwind later from the `onReturnValue` callback.
    if (result != null && !nodeId.equals(nextExecutionItem)) {
      callOnCachedCallback(nodeId, result);
      return result;
    }

    return null;
  }

  @Override
  public void updateCachedResult(UUID nodeId, Object result, boolean isPanic, long nanoTimeElapsed) {
    String resultType = typeOf(result);
    String cachedType = cache.getType(nodeId);
    FunctionCallInfo call = functionCallInfoById(nodeId);
    FunctionCallInfo cachedCall = cache.getCall(nodeId);
    ProfilingInfo[] profilingInfo = new ProfilingInfo[] {new ExecutionTime(nanoTimeElapsed)};

    ExpressionValue expressionValue =
        new ExpressionValue(
            nodeId, result, resultType, cachedType, call, cachedCall, profilingInfo, false);
    syncState.setExpressionUnsync(nodeId);
    syncState.setVisualizationUnsync(nodeId);

    // Panics are not cached because a panic can be fixed by changing seemingly unrelated code,
    // like imports, and the invalidation mechanism can not always track those changes and
    // appropriately invalidate all dependent expressions.
    if (!isPanic) {
      cache.offer(nodeId, result);
      cache.putCall(nodeId, call);
    }
    cache.putType(nodeId, resultType);

    callOnComputedCallback(expressionValue);
    if (isPanic) {
      // We mark the node as executed so that it is not reported as not executed call after the
      // program execution is complete. If we clear the call from the cache instead, it will mess
      // up the `typeChanged` field of the expression update.
      methodCallsCache.setExecuted(nodeId);
    }
  }

  @CompilerDirectives.TruffleBoundary
  private void callOnComputedCallback(ExpressionValue expressionValue) {
    onComputedCallback.accept(expressionValue);
  }

  @CompilerDirectives.TruffleBoundary
  private void callOnCachedCallback(UUID nodeId, Object result) {
    ExpressionValue expressionValue =
        new ExpressionValue(
            nodeId,
            result,
            cache.getType(nodeId),
            typeOf(result),
            calls.get(nodeId),
            cache.getCall(nodeId),
            new ProfilingInfo[] {ExecutionTime.empty()},
            true);

    onCachedCallback.accept(expressionValue);
  }

  @CompilerDirectives.TruffleBoundary
  private void callOnExecutedVisualizationCallback(ExecutedVisualization executedVisualization) {
    onExecutedVisualizationCallback.accept(executedVisualization);
  }

  @CompilerDirectives.TruffleBoundary
  private Object getCachedResult(UUID nodeId) {
    return cache.get(nodeId);
  }

  @CompilerDirectives.TruffleBoundary
  private Iterator<Visualization> findVisualizations(UUID nodeId) {
    return visualizationHolder.find(nodeId).iterator();
  }

  @CompilerDirectives.TruffleBoundary
  private FunctionCallInfo functionCallInfoById(UUID nodeId) {
    return calls.get(nodeId);
  }

  private String typeOf(Object value) {
    String resultType;
    if (value instanceof UnresolvedSymbol) {
      resultType = Constants.UNRESOLVED_SYMBOL;
    } else {
      var typeOfNode = TypeOfNode.getUncached();
      Object typeResult = value == null ? null : typeOfNode.execute(value);
      if (typeResult instanceof Type t) {
        resultType = t.getQualifiedName().toString();
      } else {
        resultType = null;
      }
    }
    return resultType;
  }
}
