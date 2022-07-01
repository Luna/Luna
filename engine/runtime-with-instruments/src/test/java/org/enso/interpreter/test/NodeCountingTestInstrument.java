package org.enso.interpreter.test;

import com.oracle.truffle.api.instrumentation.EventContext;
import com.oracle.truffle.api.instrumentation.ExecutionEventNode;
import com.oracle.truffle.api.instrumentation.ExecutionEventNodeFactory;
import com.oracle.truffle.api.instrumentation.SourceSectionFilter;
import com.oracle.truffle.api.instrumentation.TruffleInstrument;
import com.oracle.truffle.api.nodes.Node;
import com.oracle.truffle.api.source.SourceSection;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Function;
import static org.junit.Assert.fail;

/** Testing instrument to control newly created nodes. */
@TruffleInstrument.Registration(
    id = NodeCountingTestInstrument.INSTRUMENT_ID,
    services = NodeCountingTestInstrument.class)
public class NodeCountingTestInstrument extends TruffleInstrument {
  public static final String INSTRUMENT_ID = "node-count-test";
  private Map<Node, Node> all = new ConcurrentHashMap<>();
  private Map<Class, List<Node>> counter = new ConcurrentHashMap<>();
  private Env env;

  @Override
  protected void onCreate(Env env) {
    env.registerService(this);
    this.env = env;
  }

  public void enable() {
    this.env
        .getInstrumenter()
        .attachExecutionEventFactory(SourceSectionFilter.ANY, new CountingFactory());
  }

  public Map<Class, List<Node>> assertNewNodes(String msg, int min, int max) {
    Map<Class, List<Node>> prev = counter;
    long value = prev.values().stream().mapToInt(List::size).sum();

    Function<String, String> dump =
        (txt) -> {
          var sb = new StringBuilder(txt);
          prev.values().stream()
              .forEach(
                  (t) -> {
                    t.forEach(
                        (n) -> {
                          dumpNode("", n, sb);
                        });
                  });
          return sb.toString();
        };

    if (value < min) {
      fail(dump.apply(msg + ". Minimal size should be " + min + ", but was: " + value + " in"));
    }
    if (value > max) {
      fail(dump.apply(msg + ". Maximal size should be " + max + ", but was: " + value + " in"));
    }
    counter = new ConcurrentHashMap<>();
    return prev;
  }

  private void dumpNode(String indent, Node n, StringBuilder sb) {
    sb.append("\n").append(indent);
    sb.append(n.getClass().getName());
    final SourceSection ss = n.getSourceSection();
    if (ss != null) {
      sb.append(" @ ").append(ss.getSource().getName()).append(":").append(ss.getStartLine());
    }
  }

  private final class CountingFactory implements ExecutionEventNodeFactory {
    @Override
    public ExecutionEventNode create(EventContext context) {
      final Node node = context.getInstrumentedNode();
      if (!"PatchableLiteralNode".equals(node.getClass().getSimpleName())) {
        if (all.put(node, node) == null) {
          counter.computeIfAbsent(node.getClass(), (__) -> new CopyOnWriteArrayList<>()).add(node);
        }
      }
      return null;
    }
  }
}
