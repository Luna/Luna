//! This module contains functionality that allows the profiling framework to
//! generate the data required to render a flame graph. This means creating data for each block
//! that is supposed to be rendered, with start time, end time and labels.

// === Standard Linter Configuration ===
#![deny(non_ascii_idents)]
#![warn(unsafe_code)]

use crate::State::Active;
use crate::State::Paused;

use enso_profiler as profiler;
use enso_profiler_data as data;


// ==================
// === Block Data ===
// ==================

/// Indicates whether a block indicates an active interval or a paused interval. Paused intervals
/// are used to represent async tasks that are started and awaited, but that have made no progress.
#[derive(Copy, Clone, Debug)]
pub enum State {
    Active,
    Paused,
}

/// A `Block` contains the data required to render a single block of a frame graph.
#[derive(Clone, Debug)]
pub struct Block {
    /// Start x coordinate of the block.
    pub start: f64,
    /// End x coordinate of the block.
    pub end:   f64,
    /// Row that the block should be placed in.
    pub row:   u32,
    /// The label to be displayed with the block.
    pub label: String,
    /// Indicates what state this block represents (active/paused).
    pub state: State,
}

impl Block {
    /// Width of the block.
    pub fn width(&self) -> f64 {
        self.end - self.start
    }
}


// ==================
// === Mark Data ===
// ==================

/// A `Mark` contains the data required to render a mark that indicates a labeled point in time.
#[derive(Clone, Debug)]
pub struct Mark {
    /// X coordinate of the mark.
    pub position: f64,
    /// The label to be displayed with the mark.
    pub label:    String,
}



// ==================
// === Graph Data ===
// ==================

/// Contains the information required to render a graph, i.e., the data for all blocks that make up
/// the graph.
#[derive(Debug, Default)]
pub struct Graph {
    /// Collection of all blocks making up the flame graph.
    pub blocks: Vec<Block>,
    /// Collection of marks that can be shown in the flame graph.
    pub marks:  Vec<Mark>,
}

impl Graph {
    /// Create a callgraph from the given data.
    pub fn new_callgraph<Metadata>(profile: &data::Profile<Metadata>) -> Self {
        CallgraphBuilder::run(profile)
    }

    /// Create a rungraph from the given data.
    pub fn new_rungraph<Metadata>(profile: &data::Profile<Metadata>) -> Self {
        RungraphBuilder::run(profile)
    }

    /// Create a hybrid rungraph-callgraph from the given data.
    pub fn new_hybrid_graph<Metadata>(profile: &data::Profile<Metadata>) -> Self {
        new_hybrid_graph(profile)
    }

    /// Gather and remove all logged measurements and return them as a `Graph`.
    pub fn take_from_log() -> Self {
        let profile: Result<data::Profile<data::OpaqueMetadata>, _> =
            profiler::internal::take_log().parse();
        if let Ok(profile) = profile {
            new_hybrid_graph(&profile)
        } else {
            eprintln!("Failed to deserialize profiling event log.");
            Graph::default()
        }
    }
}



// ==================
// === Callgraphs ===
// ==================

/// Build a graph that illustrates the call stack over time.
struct CallgraphBuilder<'p, Metadata> {
    profile: &'p data::Profile<Metadata>,
    blocks:  Vec<Block>,
}

impl<'p, Metadata> CallgraphBuilder<'p, Metadata> {
    /// Create a callgraph for the given profile.
    fn run(profile: &'p data::Profile<Metadata>) -> Graph {
        let blocks = Default::default();
        let mut builder = Self { profile, blocks };
        // We skip the root node APP_LIFETIME, which is not a real measurement.
        for child in &profile.root_interval().children {
            builder.visit_interval(*child, 0);
        }
        let Self { blocks, .. } = builder;
        let marks = Vec::default();
        Graph { blocks, marks }
    }
}

impl<'p, Metadata> CallgraphBuilder<'p, Metadata> {
    /// Create a block for an interval; recurse into children.
    fn visit_interval(&mut self, active: data::IntervalId, row: u32) {
        let active = &self.profile[active];
        let start = active.interval.start.into_ms();
        let end = active.interval.end.map(|mark| mark.into_ms()).unwrap_or(f64::MAX);
        // Optimization: can't draw zero-width blocks anyway.
        if end == start {
            return;
        }
        let label = self.profile[active.measurement].label.to_string();
        self.blocks.push(Block { start, end, label, row, state: Active });
        for child in &active.children {
            self.visit_interval(*child, row + 1);
        }
    }
}



// =================
// === Rungraphs ===
// =================

/// Build a graph that illustrates async tasks over time.
struct RungraphBuilder<'p, Metadata> {
    profile:  &'p data::Profile<Metadata>,
    blocks:   Vec<Block>,
    next_row: u32,
}

impl<'p, Metadata> RungraphBuilder<'p, Metadata> {
    /// Create a rungraph for the given profile.
    fn run(profile: &'p data::Profile<Metadata>) -> Graph {
        let blocks = Default::default();
        let next_row = Default::default();
        let mut builder = Self { profile, blocks, next_row };
        // We skip the root node APP_LIFETIME, which is not a real measurement.
        for child in &profile.root_measurement().children {
            builder.visit_measurement(*child);
        }
        let Self { blocks, .. } = builder;
        let marks = Vec::default();
        Graph { blocks, marks }
    }
}

impl<'p, Metadata> RungraphBuilder<'p, Metadata> {
    /// Create blocks for a measurement's intervals; recurse into children.
    fn visit_measurement(&mut self, measurement: data::MeasurementId) {
        let measurement = &self.profile[measurement];
        // We're only interested in tasks that await other tasks, i.e. have at least 2 intervals.
        if measurement.intervals.len() >= 2 {
            let row = self.next_row;
            self.next_row += 1;
            for window in measurement.intervals.windows(2) {
                if let [current, next] = window {
                    let current = &self.profile[*current];
                    let next = &self.profile[*next];

                    let current_start = current.interval.start.into_ms();
                    let current_end =
                        current.interval.end.map(|mark| mark.into_ms()).unwrap_or(f64::MAX);
                    let next_start = next.interval.start.into_ms();

                    let active_interval = [current_start, current_end];
                    let sleep_interval = [current_end, next_start];

                    let label_active = self.profile[current.measurement].label.to_string();
                    let label_sleep =
                        format!("{} (inactive)", self.profile[current.measurement].label);

                    self.blocks.push(Block {
                        start: active_interval[0],
                        end: active_interval[1],
                        label: label_active,
                        row,
                        state: Active,
                    });

                    self.blocks.push(Block {
                        start: sleep_interval[0],
                        end: sleep_interval[1],
                        label: label_sleep,
                        row,
                        state: Paused,
                    });
                }
            }
            let last = measurement.intervals.last().unwrap(); // There are at least two intervals.
            let last = &self.profile[*last];
            self.blocks.push(Block {
                start: last.interval.start.into_ms(),
                end: last.interval.end.map(|end| end.into_ms()).unwrap_or(f64::INFINITY),
                label: self.profile[last.measurement].label.to_string(),
                row,
                state: Active,
            });
        }
        for child in &measurement.children {
            self.visit_measurement(*child);
        }
    }
}


// === hybrid graph ===

/// Create a rungraph+callgraph for the given profile.
fn new_hybrid_graph<Metadata>(profile: &data::Profile<Metadata>) -> Graph {
    let blocks = Default::default();
    let next_row = Default::default();
    let mut rungraph = RungraphBuilder { profile, blocks, next_row };
    for child in &profile.root_measurement().children {
        rungraph.visit_measurement(*child);
    }
    let RungraphBuilder { blocks, next_row, .. } = rungraph;
    let mut callgraph = CallgraphBuilder { profile, blocks };
    for child in &profile.root_interval().children {
        callgraph.visit_interval(*child, next_row);
    }
    let CallgraphBuilder { blocks, .. } = callgraph;
    let marks = Vec::default();
    Graph { blocks, marks }
}



// ===================
// === Flamegraphs ===
// ===================

/// Build a graph that illustrates aggregate time spent in different functions.
#[derive(Default)]
pub struct FlamegraphBuilder {
    aggregator: data::aggregate::Aggregator,
}

impl FlamegraphBuilder {
    /// Add data from a profile to the graph.
    pub fn add_profile<Metadata>(&mut self, profile: &data::Profile<Metadata>) {
        self.aggregator.add_profile(profile);
    }
}

impl From<FlamegraphBuilder> for Graph {
    fn from(builder: FlamegraphBuilder) -> Self {
        let mut grapher = FlamegraphGrapher::default();
        let root = data::aggregate::Frame::from(builder.aggregator);
        for (label, frame) in &root.children {
            grapher.visit_frame(frame, label.to_string(), 0);
        }
        let FlamegraphGrapher { blocks, .. } = grapher;
        let marks = Vec::default();
        Self { blocks, marks }
    }
}

/// Builds a flamegraph [`Graph`] from [`data::aggregate::Frame`]s.
#[derive(Default)]
struct FlamegraphGrapher {
    blocks: Vec<Block>,
    time:   f64,
}

impl FlamegraphGrapher {
    fn visit_frame(&mut self, frame: &data::aggregate::Frame, label: String, row: u32) {
        let start = self.time;
        let end = self.time + frame.total_duration();
        self.blocks.push(Block { start, end, label, row, state: State::Active });
        for (label, frame) in &frame.children {
            self.visit_frame(frame, label.to_string(), row + 1);
        }
        self.time = end;
    }
}



// =============
// === Tests ===
// =============

#[cfg(test)]
mod tests {
    use super::*;
    use profiler::profile;

    #[profile(Objective)]
    pub fn profiled_a() {
        profiled_b()
    }
    #[profile(Objective)]
    pub fn profiled_b() {}

    #[test]
    fn check_flame_graph_creation() {
        profiled_a();

        let profile: data::Profile<data::OpaqueMetadata> =
            profiler::internal::take_log().parse().unwrap();
        let flame_graph = Graph::new_callgraph(&profile);
        assert_eq!(flame_graph.blocks.len(), 2);

        assert_eq!(flame_graph.blocks[1].row, 1);
        assert!(flame_graph.blocks[1].label.contains("profiled_b"));
        assert_eq!(flame_graph.blocks[0].row, 0);
        assert!(flame_graph.blocks[0].label.contains("profiled_a"));
    }
}
