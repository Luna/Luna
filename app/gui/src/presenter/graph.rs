//! The module with the [`Graph`] presenter. See [`crate::presenter`] documentation to know more
//! about presenters in general.

use crate::prelude::*;
use enso_web::traits::*;
use span_tree::generate::Context as _;

use crate::controller::graph::widget::Request as WidgetRequest;
use crate::controller::upload::NodeFromDroppedFileHandler;
use crate::executor::global::spawn_stream_handler;
use crate::presenter::graph::state::State;

use double_representation::context_switch::Context;
use double_representation::context_switch::ContextSwitch;
use double_representation::context_switch::ContextSwitchExpression;
use enso_frp as frp;
use futures::future::LocalBoxFuture;
use ide_view as view;
use ide_view::graph_editor::component::node as node_view;
use ide_view::graph_editor::component::visualization as visualization_view;
use ide_view::graph_editor::EdgeEndpoint;
use view::graph_editor::CallWidgetsConfig;


// ==============
// === Export ===
// ==============

pub mod call_stack;
pub mod state;
pub mod visualization;

pub use call_stack::CallStack;
pub use visualization::Visualization;



// ===============
// === Aliases ===
// ===============

/// The node identifier used by view.
pub type ViewNodeId = view::graph_editor::NodeId;

/// The node identifier used by controllers.
pub type AstNodeId = ast::Id;

/// The connection identifier used by view.
pub type ViewConnection = view::graph_editor::EdgeId;

/// The connection identifier used by controllers.
pub type AstConnection = controller::graph::Connection;


// =================
// === Constants ===
// =================

/// The identifier base that will be used to name the methods introduced by "collapse nodes"
/// refactoring. Names are typically generated by taking base and appending subsequent integers,
/// until the generated name does not collide with any known identifier.
const COLLAPSED_FUNCTION_NAME: &str = "func";

/// The default X position of the node when user did not set any position of node - possibly when
/// node was added by editing text.
const DEFAULT_NODE_X_POSITION: f32 = -100.0;
/// The default Y position of the node when user did not set any position of node - possibly when
/// node was added by editing text.
const DEFAULT_NODE_Y_POSITION: f32 = 200.0;

/// Default node position -- acts as a starting points for laying out nodes with no position defined
/// in the metadata.
pub fn default_node_position() -> Vector2 {
    Vector2::new(DEFAULT_NODE_X_POSITION, DEFAULT_NODE_Y_POSITION)
}



// =============
// === Model ===
// =============

#[derive(Debug)]
struct Model {
    project:          model::Project,
    controller:       controller::ExecutedGraph,
    view:             view::graph_editor::GraphEditor,
    state:            Rc<State>,
    _visualization:   Visualization,
    widget:           controller::Widget,
    _execution_stack: CallStack,
}

impl Model {
    pub fn new(
        project: model::Project,
        controller: controller::ExecutedGraph,
        view: view::graph_editor::GraphEditor,
    ) -> Self {
        let state: Rc<State> = default();
        let visualization = Visualization::new(
            project.clone_ref(),
            controller.clone_ref(),
            view.clone_ref(),
            state.clone_ref(),
        );
        let widget = controller::Widget::new(controller.clone_ref());
        let execution_stack =
            CallStack::new(controller.clone_ref(), view.clone_ref(), state.clone_ref());
        Self {
            project,
            controller,
            view,
            state,
            _visualization: visualization,
            widget,
            _execution_stack: execution_stack,
        }
    }

    /// Node position was changed in view.
    fn node_position_changed(&self, id: ViewNodeId, position: Vector2) {
        self.log_action(
            || {
                let ast_id = self.state.update_from_view().set_node_position(id, position)?;
                Some(self.controller.graph().set_node_position(ast_id, position))
            },
            "update node position",
        );
    }

    fn node_visualization_changed(&self, id: ViewNodeId, path: Option<visualization_view::Path>) {
        self.log_action(
            || {
                let ast_id =
                    self.state.update_from_view().set_node_visualization(id, path.clone())?;
                let module = self.controller.graph().module;
                let result = match serde_json::to_value(path) {
                    Ok(serialized) => module
                        .with_node_metadata(ast_id, Box::new(|md| md.visualization = serialized)),
                    Err(err) => FallibleResult::Err(err.into()),
                };
                Some(result)
            },
            "update node visualization",
        );
    }

    /// Update a part of node expression under specific span tree crumbs. Preserves identity of
    /// unaffected parts of the expression.
    fn node_expression_span_set(
        &self,
        id: ViewNodeId,
        crumbs: &span_tree::Crumbs,
        expression: ImString,
    ) {
        self.log_action(
            || {
                let expression = expression.as_str();
                let update = self.state.update_from_view();
                let ast_id = update.check_node_expression_span_update(id, crumbs, expression)?;
                let graph = self.controller.graph();
                Some(graph.set_expression_span(ast_id, crumbs, expression, &self.controller))
            },
            "update expression input span",
        );
    }

    /// Sets or clears a context switch expression for the specified node.
    ///
    /// A context switch expression allows enabling or disabling the execution of a particular node
    /// in the Output context. This function adds or removes the context switch expression based on
    /// the provided `active` flag (representing the state of the icon) and the current context
    /// state.
    ///
    /// The behavior of this function can be summarized in the following table:
    /// ```ignore
    /// | Global Context Permission | Active      | Action       |
    /// |---------------------------|-------------|--------------|
    /// | Enabled                   | Yes         | Add Disable  |
    /// | Enabled                   | No          | Clear        |
    /// | Disabled                  | Yes         | Add Enable   |
    /// | Disabled                  | No          | Clear        |
    /// ```
    fn node_action_context_switch(&self, id: ViewNodeId, active: bool) {
        let context = Context::Output;
        let environment = self.controller.execution_environment();
        let current_state = environment.output_context_enabled();
        let switch = if current_state { ContextSwitch::Disable } else { ContextSwitch::Enable };
        let expr = if active {
            let environment_name = environment.to_string().into();
            Some(ContextSwitchExpression { switch, context, environment: environment_name })
        } else {
            None
        };
        self.log_action(
            || {
                let ast_id =
                    self.state.update_from_view().set_node_context_switch(id, expr.clone())?;
                Some(self.controller.graph().set_node_context_switch(ast_id, expr))
            },
            "node context switch expression",
        );
    }

    /// The user skipped the node by pressing on the "skip" button next to it.
    fn node_action_skip(&self, id: ViewNodeId, enabled: bool) {
        self.log_action(
            || {
                let ast_id = self.state.update_from_view().set_node_skip(id, enabled)?;
                Some(self.controller.graph().set_node_action_skip(ast_id, enabled))
            },
            "skip node",
        );
    }

    /// The user frozen the node by pressing on the "freeze" button next to it.
    fn node_action_freeze(&self, id: ViewNodeId, enabled: bool) {
        self.log_action(
            || {
                let ast_id = self.state.update_from_view().set_node_freeze(id, enabled)?;
                Some(self.controller.graph().set_node_action_freeze(ast_id, enabled))
            },
            "freeze node",
        );
    }

    fn add_import_if_missing(&self, import_path: &str) {
        self.log_action(
            || {
                let qualified_name =
                    double_representation::name::QualifiedName::from_text(import_path);
                let result = qualified_name
                    .and_then(|name| self.controller.graph().add_import_if_missing(name));
                Some(result)
            },
            "add import if missing",
        );
    }

    /// Update the widget target expression of a node. When this widget can be requested right now,
    /// return the request structure.
    fn update_widget_request_data(
        &self,
        call_expression: ast::Id,
        target_expression: ast::Id,
    ) -> Option<WidgetRequest> {
        let node_id = self
            .state
            .update_from_view()
            .set_call_expression_target_id(call_expression, Some(target_expression))?;
        let call_suggestion = self.controller.call_info(call_expression)?.suggestion_id?;
        Some(WidgetRequest { node_id, call_expression, target_expression, call_suggestion })
    }

    /// Map widget controller update data to the node views.
    fn map_widget_configuration(
        &self,
        node_id: AstNodeId,
        config: CallWidgetsConfig,
    ) -> Option<(ViewNodeId, CallWidgetsConfig)> {
        let node_id = self.state.view_id_of_ast_node(node_id)?;
        Some((node_id, config))
    }

    /// Node was removed in view.
    fn node_removed(&self, id: ViewNodeId) {
        self.log_action(
            || {
                let ast_id = self.state.update_from_view().remove_node(id)?;
                self.widget.remove_all_node_widgets(ast_id);
                Some(self.controller.graph().remove_node(ast_id))
            },
            "remove node",
        )
    }

    /// Connection was created in view.
    fn new_connection_created(&self, id: ViewConnection) {
        self.log_action(
            || {
                let connection = self.view.model.edges.get_cloned_ref(&id)?;
                let ast_to_create = self.state.update_from_view().create_connection(connection)?;
                Some(self.controller.connect(&ast_to_create))
            },
            "create connection",
        );
    }

    /// Connection was removed in view.
    fn connection_removed(&self, id: ViewConnection) {
        self.log_action(
            || {
                let update = self.state.update_from_view();
                let ast_to_remove = update.remove_connection(id)?;
                Some(self.controller.disconnect(&ast_to_remove).map(|target_crumbs| {
                    if let Some(crumbs) = target_crumbs {
                        trace!(
                            "Updating edge target after disconnecting it. New crumbs: {crumbs:?}"
                        );
                        // If we are still using this edge (e.g. when dragging it), we need to
                        // update its target endpoint. Otherwise it will not reflect expression
                        // update performed on the target node.
                        self.view.replace_detached_edge_target((id, crumbs));
                    };
                }))
            },
            "delete connection",
        );
    }

    fn nodes_collapsed(&self, collapsed: &[ViewNodeId]) {
        self.log_action(
            || {
                debug!("Collapsing node.");
                let ids = collapsed.iter().filter_map(|node| self.state.ast_node_id_of_view(*node));
                let new_node_id = self.controller.graph().collapse(ids, COLLAPSED_FUNCTION_NAME);
                // TODO [mwu] https://github.com/enso-org/ide/issues/760
                //   As part of this issue, storing relation between new node's controller and view
                //   ids will be necessary.
                Some(new_node_id.map(|_| ()))
            },
            "collapse nodes",
        );
    }

    fn log_action<F>(&self, f: F, action: &str)
    where F: FnOnce() -> Option<FallibleResult> {
        if let Some(Err(err)) = f() {
            error!("Failed to {action} in AST: {err}");
        }
    }

    /// Extract all types for subexpressions in node expressions, update the state,
    /// and return the events for graph editor FRP input setting all of those types.
    ///
    /// The result includes the types not changed according to the state. That's because this
    /// function is used after node expression change, and we need to reset all the types in view.
    fn all_types_of_node(
        &self,
        node: ViewNodeId,
    ) -> Vec<(ViewNodeId, ast::Id, Option<view::graph_editor::Type>)> {
        let subexpressions = self.state.expressions_of_node(node);
        subexpressions
            .into_iter()
            .map(|id| {
                let a_type = self.expression_type(id);
                self.state.update_from_controller().set_expression_type(id, a_type.clone());
                (node, id, a_type)
            })
            .collect()
    }

    /// Refresh type of the given expression.
    ///
    /// If the view update is required, the GraphEditor's FRP input event is returned.
    fn refresh_expression_type(
        &self,
        id: ast::Id,
    ) -> Option<(ViewNodeId, ast::Id, Option<view::graph_editor::Type>)> {
        let a_type = self.expression_type(id);
        let node_view =
            self.state.update_from_controller().set_expression_type(id, a_type.clone())?;
        Some((node_view, id, a_type))
    }

    /// Refresh method pointer of the given expression in order to check if its widgets require an
    /// update and should be queried.
    ///
    /// If the view update is required, the widget query data is returned.
    fn refresh_expression_widgets(&self, expr_id: ast::Id) -> Option<(ast::Id, ast::Id)> {
        let suggestion = self.controller.call_info(expr_id).and_then(|i| i.suggestion_id);
        let (_, method_target_id) =
            self.state.update_from_controller().set_expression_suggestion(expr_id, suggestion)?;
        Some((expr_id, method_target_id?))
    }

    /// Extract all widget queries for all node subexpressions that require an update. Returns all
    fn refresh_all_widgets_of_node(
        &self,
        node: ViewNodeId,
    ) -> (Option<(AstNodeId, HashSet<ast::Id>)>, Vec<(ast::Id, ast::Id)>) {
        let subexpressions = self.state.expressions_of_node(node);
        let expressions_map = subexpressions.iter().cloned().collect();
        let node_id = self.state.ast_node_id_of_view(node);
        let node_expressions = node_id.map(|id| (id, expressions_map));
        let queries = subexpressions
            .into_iter()
            .filter_map(|id| self.refresh_expression_widgets(id))
            .collect();
        (node_expressions, queries)
    }

    fn refresh_node_error(
        &self,
        expression: ast::Id,
    ) -> Option<(ViewNodeId, Option<node_view::Error>)> {
        let registry = self.controller.computed_value_info_registry();
        let payload = registry.get(&expression).map(|info| info.payload.clone());
        self.state.update_from_controller().set_node_error_from_payload(expression, payload)
    }

    /// Extract the expression's current type from controllers.
    fn expression_type(&self, id: ast::Id) -> Option<view::graph_editor::Type> {
        let registry = self.controller.computed_value_info_registry();
        let info = registry.get(&id)?;
        Some(view::graph_editor::Type(info.typename.as_ref()?.clone_ref()))
    }

    fn file_dropped(&self, file: ensogl_drop_manager::File, position: Vector2<f32>) {
        let project = self.project.clone_ref();
        let graph = self.controller.graph();
        let to_upload = controller::upload::FileToUpload {
            name: file.name.clone_ref().into(),
            size: file.size,
            data: file,
        };
        let position = model::module::Position { vector: position };
        let handler = NodeFromDroppedFileHandler::new(project, graph);
        if let Err(err) = handler.create_node_and_start_uploading(to_upload, position) {
            error!("Error when creating node from dropped file: {err}");
        }
    }

    /// Look through all graph's nodes in AST and set position where it is missing.
    fn initialize_nodes_positions(&self, default_gap_between_nodes: f32) {
        match self.controller.graph().nodes() {
            Ok(nodes) => {
                use model::module::Position;

                let base_default_position = default_node_position();
                let node_positions =
                    nodes.iter().filter_map(|node| node.metadata.as_ref()?.position);
                let bottommost_pos = node_positions
                    .min_by(Position::ord_by_y)
                    .map(|p| p.vector)
                    .unwrap_or(base_default_position);

                let offset = default_gap_between_nodes + node_view::HEIGHT;
                let mut next_default_position =
                    Vector2::new(bottommost_pos.x, bottommost_pos.y - offset);

                let transaction =
                    self.controller.get_or_open_transaction("Setting default positions.");
                transaction.ignore();
                for node in nodes {
                    if !node.has_position() {
                        if let Err(err) = self
                            .controller
                            .graph()
                            .set_node_position(node.id(), next_default_position)
                        {
                            warn!("Failed to initialize position of node {}: {err}", node.id());
                        }
                        next_default_position.y -= offset;
                    }
                }
            }
            Err(err) => {
                warn!("Failed to initialize nodes positions: {err}");
            }
        }
    }

    fn reopen_file_in_ls(&self) {
        let module = self.controller.graph().module.clone_ref();
        executor::global::spawn(async move {
            if let Err(error) = module.reopen_file_in_language_server().await {
                error!("Error while reopening file in Language Server: {error}");
            }
        });
    }
}



// ==================
// === ViewUpdate ===
// ==================

// === ExpressionUpdate ===

/// Helper struct storing information about node's expression updates.
/// Includes not only the updated expression, but also an information about `SKIP` and
/// `FREEZE` macros updates, and also execution context updates.
#[derive(Clone, Debug, Default)]
struct ExpressionUpdate {
    id:                     ViewNodeId,
    expression:             node_view::Expression,
    skip_updated:           Option<bool>,
    freeze_updated:         Option<bool>,
    context_switch_updated: Option<Option<ContextSwitchExpression>>,
}

impl ExpressionUpdate {
    /// The updated expression.
    fn expression(&self) -> (ViewNodeId, node_view::Expression) {
        (self.id, self.expression.clone())
    }

    /// An updated status of `SKIP` macro. `None` if the status was not updated.
    fn skip(&self) -> Option<(ViewNodeId, bool)> {
        self.skip_updated.map(|skip| (self.id, skip))
    }

    /// An updated status of `FREEZE` macro. `None` if the status was not updated.
    fn freeze(&self) -> Option<(ViewNodeId, bool)> {
        self.freeze_updated.map(|freeze| (self.id, freeze))
    }

    /// An updated status of output context switch: `true` (or `false`) if the output context was
    /// explicitly enabled (or disabled) for the node, `None` otherwise. The outer `Option` is
    /// `None` if the status was not updated.
    fn output_context(&self) -> Option<(ViewNodeId, Option<bool>)> {
        self.context_switch_updated.as_ref().map(|context_switch_expr| {
            let switch =
                context_switch_expr.as_ref().map(|expr| expr.switch == ContextSwitch::Enable);
            (self.id, switch)
        })
    }
}


// === ViewUpdate ===

/// Structure handling view update after graph invalidation.
///
/// Because updating various graph elements (nodes, connections, types) bases on the same data
/// extracted from controllers, the data are cached in this structure.
#[derive(Clone, Debug, Default)]
struct ViewUpdate {
    state:       Rc<State>,
    nodes:       Vec<controller::graph::Node>,
    trees:       HashMap<AstNodeId, controller::graph::NodeTrees>,
    connections: HashSet<AstConnection>,
}

impl ViewUpdate {
    /// Create ViewUpdate information from Graph Presenter's model.
    fn new(model: &Model) -> FallibleResult<Self> {
        let state = model.state.clone_ref();
        let nodes = model.controller.graph().nodes()?;
        let connections_and_trees = model.controller.connections()?;
        let connections = connections_and_trees.connections.into_iter().collect();
        let trees = connections_and_trees.trees;
        Ok(Self { state, nodes, trees, connections })
    }

    /// Remove nodes from the state and return node views to be removed.
    fn remove_nodes(&self) -> Vec<ViewNodeId> {
        self.state.update_from_controller().retain_nodes(&self.node_ids().collect())
    }

    /// Returns number of nodes view should create.
    fn count_nodes_to_add(&self) -> usize {
        self.node_ids().filter(|n| self.state.view_id_of_ast_node(*n).is_none()).count()
    }

    /// Set the nodes expressions in state, and return the events to be passed to Graph Editor FRP
    /// input for nodes where expression changed.
    ///
    /// The nodes not having views are also updated in the state.
    #[profile(Task)]
    fn set_node_expressions(&self) -> Vec<ExpressionUpdate> {
        self.nodes
            .iter()
            .filter(|node| self.state.should_receive_expression_auto_updates(node.id()))
            .filter_map(|node| {
                let id = node.main_line.id();
                let trees = self.trees.get(&id).cloned().unwrap_or_default();
                let change = self.state.update_from_controller();
                if let Some((id, expression)) = change.set_node_expression(node, trees) {
                    let skip_updated = change.set_node_skip(node);
                    let freeze_updated = change.set_node_freeze(node);
                    let context_switch_updated = change.set_node_context_switch(node);
                    Some(ExpressionUpdate {
                        id,
                        expression,
                        skip_updated,
                        freeze_updated,
                        context_switch_updated,
                    })
                } else {
                    None
                }
            })
            .collect()
    }

    /// Set the nodes position in state, and return the events to be passed to GraphEditor FRP
    /// input for nodes where position changed.
    ///
    /// The nodes not having views are also updated in the state.
    fn set_node_positions(&self) -> Vec<(ViewNodeId, Vector2)> {
        self.nodes
            .iter()
            .filter_map(|node| {
                let id = node.main_line.id();
                let position = node.position().map(|p| p.vector)?;
                let view_id =
                    self.state.update_from_controller().set_node_position(id, position)?;
                Some((view_id, position))
            })
            .collect()
    }

    fn set_node_visualizations(&self) -> Vec<(ViewNodeId, Option<visualization_view::Path>)> {
        self.nodes
            .iter()
            .filter_map(|node| {
                let data = node.metadata.as_ref().map(|md| md.visualization.clone());
                self.state.update_from_controller().set_node_visualization(node.id(), data)
            })
            .collect()
    }

    /// Remove connections from the state and return views to be removed.
    fn remove_connections(&self) -> Vec<ViewConnection> {
        self.state.update_from_controller().retain_connections(&self.connections)
    }

    /// Add connections to the state and return endpoints of connections to be created in views.
    fn add_connections(&self) -> Vec<(EdgeEndpoint, EdgeEndpoint)> {
        let ast_conns = self.connections.iter();
        ast_conns
            .filter_map(|connection| {
                self.state.update_from_controller().set_connection(connection.clone())
            })
            .collect()
    }

    fn node_ids(&self) -> impl Iterator<Item = AstNodeId> + '_ {
        self.nodes.iter().map(controller::graph::Node::id)
    }
}



// =============
// === Graph ===
// =============

/// The Graph Presenter, synchronizing graph state between graph controller and view.
///
/// This presenter focuses on the graph structure: nodes, their expressions and types, and
/// connections between them. It does not integrate Searcher nor Breadcrumbs (managed by
/// [`presenter::Searcher`] and [`presenter::CallStack`] respectively).
#[derive(Debug)]
pub struct Graph {
    network: frp::Network,
    model:   Rc<Model>,
}

impl Graph {
    /// Create graph presenter. The returned structure is working and does not require any
    /// initialization.
    #[profile(Task)]
    pub fn new(
        project: model::Project,
        controller: controller::ExecutedGraph,
        project_view: &view::project::View,
    ) -> Self {
        let network = frp::Network::new("presenter::Graph");
        let view = project_view.graph().clone_ref();
        let model = Rc::new(Model::new(project, controller, view));
        Self { network, model }.init(project_view)
    }

    #[profile(Detail)]
    fn init(self, project_view: &view::project::View) -> Self {
        let network = &self.network;
        let model = &self.model;
        let view = &model.view.frp;

        frp::extend! { network
            update_view <- source::<()>();
            // Position initialization should go before emitting `update_data` event.
            update_with_gap <- view.default_y_gap_between_nodes.sample(&update_view);
            eval update_with_gap ((gap) model.initialize_nodes_positions(*gap));
            update_data <- update_view.map(f_!([model] match ViewUpdate::new(&model) {
                Ok(update) => Rc::new(update),
                Err(err) => {
                    error!("Failed to update view: {err:?}");
                    Rc::new(default())
                }
            }));

            // === Refreshing Nodes ===

            remove_node <= update_data.map(|update| update.remove_nodes());
            expression_update <= update_data.map(|update| update.set_node_expressions());
            update_node_expression <- expression_update.map(ExpressionUpdate::expression);
            set_node_skip <- expression_update.filter_map(ExpressionUpdate::skip);
            set_node_freeze <- expression_update.filter_map(ExpressionUpdate::freeze);
            set_node_context_switch <- expression_update.filter_map(ExpressionUpdate::output_context);
            set_node_position <= update_data.map(|update| update.set_node_positions());
            set_node_visualization <= update_data.map(|update| update.set_node_visualizations());
            enable_vis <- set_node_visualization.filter_map(|(id,path)| path.is_some().as_some(*id));
            disable_vis <- set_node_visualization.filter_map(|(id,path)| path.is_none().as_some(*id));
            view.remove_node <+ remove_node;
            view.set_node_expression <+ update_node_expression;
            view.set_node_skip <+ set_node_skip;
            view.set_node_freeze <+ set_node_freeze;
            view.set_node_context_switch <+ set_node_context_switch;
            view.set_node_position <+ set_node_position;
            view.set_visualization <+ set_node_visualization;
            view.enable_visualization <+ enable_vis;
            view.disable_visualization <+ disable_vis;

            view.add_node <+ update_data.map(|update| update.count_nodes_to_add()).repeat();
            added_node_update <- view.node_added.filter_map(f!(((view_id, _, _))
                model.state.assign_node_view(*view_id)
            ));
            init_node_expression <- added_node_update.filter_map(|update| Some((update.view_id?, update.expression.clone())));
            view.set_node_expression <+ init_node_expression;
            view.set_node_position <+ added_node_update.filter_map(|update| Some((update.view_id?, update.position)));
            view.set_visualization <+ added_node_update.filter_map(|update| Some((update.view_id?, Some(update.visualization.clone()?))));
            view.enable_visualization <+ added_node_update.filter_map(|update| update.visualization.is_some().and_option(update.view_id));


            // === Refreshing Connections ===

            remove_connection <= update_data.map(|update| update.remove_connections());
            add_connection <= update_data.map(|update| update.add_connections());
            view.remove_edge <+ remove_connection;
            view.connect_nodes <+ add_connection;


            // === Refreshing Expressions ===

            reset_node_types <- any(update_node_expression, init_node_expression)._0();
            set_expression_type <= reset_node_types.map(f!((view_id) model.all_types_of_node(*view_id)));
            view.set_expression_usage_type <+ set_expression_type;

            update_expressions <- source::<Vec<ast::Id>>();
            update_expression <= update_expressions;
            view.set_expression_usage_type <+ update_expression.filter_map(f!((id) model.refresh_expression_type(*id)));
            view.set_node_error_status <+ update_expression.filter_map(f!((id) model.refresh_node_error(*id)));

            self.init_widgets(reset_node_types, update_expression.clone_ref());

            // === Changes from the View ===

            eval view.node_position_set_batched(((node_id, position)) model.node_position_changed(*node_id, *position));
            eval view.node_removed((node_id) model.node_removed(*node_id));
            eval view.on_edge_endpoints_set((edge_id) model.new_connection_created(*edge_id));
            eval view.on_edge_endpoint_unset(((edge_id,_)) model.connection_removed(*edge_id));
            eval view.nodes_collapsed(((nodes, _)) model.nodes_collapsed(nodes));
            eval view.enabled_visualization_path(((node_id, path)) model.node_visualization_changed(*node_id, path.clone()));
            eval view.node_expression_span_set(((node_id, crumbs, expression)) model.node_expression_span_set(*node_id, crumbs, expression.clone_ref()));
            eval view.node_action_context_switch(((node_id, active)) model.node_action_context_switch(*node_id, *active));
            eval view.node_action_skip(((node_id, enabled)) model.node_action_skip(*node_id, *enabled));
            eval view.node_action_freeze(((node_id, enabled)) model.node_action_freeze(*node_id, *enabled));
            eval view.request_import((import_path) model.add_import_if_missing(import_path));
            eval_ view.reopen_file_in_language_server (model.reopen_file_in_ls());


            // === Dropping Files ===

            file_upload_requested <- view.file_dropped.gate(&project_view.drop_files_enabled);
            eval file_upload_requested (((file,position)) model.file_dropped(file.clone_ref(),*position));
        }

        view.remove_all_nodes();
        update_view.emit(());
        self.setup_controller_notification_handlers(update_view, update_expressions);

        self
    }

    /// Initialize the FRP network for querying and updating expression widgets.
    fn init_widgets(
        &self,
        reset_node_types: frp::Stream<ViewNodeId>,
        update_expression: frp::Stream<ast::Id>,
    ) {
        let network = &self.network;
        let model = &self.model;
        let view = &model.view.frp;
        let widget = &model.widget;

        frp::extend! { network
            widget_refresh <- reset_node_types.map(
                f!((view_id) model.refresh_all_widgets_of_node(*view_id))
            );
            widgets_to_update <- any(...);
            widgets_to_update <+ widget_refresh._1().iter();
            widgets_to_update <+ update_expression.filter_map(
                f!((id) model.refresh_expression_widgets(*id))
            );
            widgets_to_update <+ view.widgets_requested.map(|(_, call, target)| (*call, *target));
            widget_request <- widgets_to_update.filter_map(
                f!(((call, target)) model.update_widget_request_data(*call, *target))
            );
            widget.request_widgets <+ widget_request;
            widget.retain_node_expressions <+ widget_refresh._0().unwrap();
            view.update_node_widgets <+ widget.widget_data.filter_map(
                f!(((id, data)) model.map_widget_configuration(*id, data.clone()))
            );
        }
    }

    fn setup_controller_notification_handlers(
        &self,
        update_view: frp::Source<()>,
        update_expressions: frp::Source<Vec<ast::Id>>,
    ) {
        use crate::controller::graph::executed;
        use crate::controller::graph::Notification;
        let graph_notifications = self.model.controller.subscribe();
        let weak = Rc::downgrade(&self.model);
        spawn_stream_handler(weak, graph_notifications, move |notification, _model| {
            debug!("Received controller notification {notification:?}");
            match notification {
                executed::Notification::Graph(graph) => match graph {
                    Notification::Invalidate => update_view.emit(()),
                    Notification::PortsUpdate => update_view.emit(()),
                },
                executed::Notification::ComputedValueInfo(expressions) =>
                    update_expressions.emit(expressions),
                executed::Notification::EnteredStack(_)
                | executed::Notification::ExitedStack(_) => update_view.emit(()),
            }
            std::future::ready(())
        })
    }
}


// === State Access ===

impl Graph {
    /// Get the view id of given AST node.
    pub fn view_id_of_ast_node(&self, id: AstNodeId) -> Option<ViewNodeId> {
        self.model.state.view_id_of_ast_node(id)
    }

    /// Get the AST ID of given node view.
    pub fn ast_node_of_view(&self, id: ViewNodeId) -> Option<AstNodeId> {
        self.model.state.ast_node_id_of_view(id)
    }

    /// Assign a node view to the given AST ID. Since next update, the presenter will share the
    /// node content between the controllers and the view.
    pub fn assign_node_view_explicitly(&self, view_id: ViewNodeId, ast_id: AstNodeId) {
        self.model.state.assign_node_view_explicitly(view_id, ast_id);
    }

    /// Indicate whether the given node should be automatically synced with its view.
    ///
    /// The auto sync can be disabled, for cases where it is desirable to manually update the
    /// content of a node. For example, the searcher uses this to allow the edit field to have a
    /// preview that is different from the actual node AST.
    pub fn allow_expression_auto_updates(&self, id: AstNodeId, allow: bool) {
        debug!("Setting auto updates for {id:?} to {allow}");
        self.model.state.allow_expression_auto_updates(id, allow);
    }
}



// ====================================
// === DataProvider for EnsoGL File ===
// ====================================

impl controller::upload::DataProvider for ensogl_drop_manager::File {
    fn next_chunk(&mut self) -> LocalBoxFuture<FallibleResult<Option<Vec<u8>>>> {
        self.read_chunk()
            .map(|f| f.map_err(|e| StringError::new(e.print_to_string()).into()))
            .boxed_local()
    }
}



// =============
// === Error ===
// =============

/// Generic error representation. This is used only once in the lines above. Probably should be
/// removed in the future.
#[derive(Debug, Fail)]
#[fail(display = "{}", message)]
pub struct StringError {
    message: String,
}

impl StringError {
    /// Constructor.
    pub fn new(message: impl Into<String>) -> StringError {
        let message = message.into();
        StringError { message }
    }
}
