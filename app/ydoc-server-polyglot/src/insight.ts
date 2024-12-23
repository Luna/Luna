print("Initializing Insight: " + JSON.stringify(insight));

insight.on("source", function(ctx, frame) {
  print(`[source] ctx.uri=${ctx.uri}`)
});

insight.on("return", function(ctx, frame) {
  print(`[return] ctx='${JSON.stringify(ctx)}'`)
  print(`[return] frame='${JSON.stringify(frame)}'`)
  print(`[return] ctx.returnValue='${JSON.stringify(ctx.returnValue(frame))}'`)
}, {
  expressions: true,
  statements: true,
  roots: true,
  rootNameFilter: ".*main"
});
