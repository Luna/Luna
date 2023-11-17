package org.enso.interpreter.epb;

import com.oracle.truffle.api.CallTarget;
import com.oracle.truffle.api.TruffleLanguage;
import java.util.function.Consumer;
import org.enso.interpreter.epb.node.ForeignEvalNode;
import org.enso.polyglot.ForeignLanguage;

/** An internal language that serves as a bridge between Enso and other supported languages. */
@TruffleLanguage.Registration(
    id = ForeignLanguage.ID,
    name = "Enso Polyglot Bridge",
    characterMimeTypes = {EpbLanguage.MIME},
    internal = true,
    defaultMimeType = EpbLanguage.MIME,
    contextPolicy = TruffleLanguage.ContextPolicy.SHARED,
    services = Consumer.class)
public class EpbLanguage extends TruffleLanguage<EpbContext> {
  public static final String MIME = "application/epb";

  @Override
  protected EpbContext createContext(Env env) {
    var ctx = new EpbContext(env);
    Consumer<String> init = ctx::initialize;
    env.registerService(init);
    return ctx;
  }

  @Override
  protected void initializeContext(EpbContext context) {
    context.initialize(null);
  }

  @Override
  protected CallTarget parse(ParsingRequest request) {
    EpbParser.Result code = EpbParser.parse(request.getSource());
    ForeignEvalNode foreignEvalNode = ForeignEvalNode.build(this, code, request.getArgumentNames());
    return foreignEvalNode.getCallTarget();
  }

  @Override
  protected boolean isThreadAccessAllowed(Thread thread, boolean singleThreaded) {
    return true;
  }
}
