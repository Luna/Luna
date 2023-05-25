//! Edge layout calculation.
//!
//! # Corners
//!
//!   ────╮
//!
//! The fundamental unit of edge layout is the [`Corner`]. A corner is a line segment attached to a
//! 90° arc. The length of the straight segment, the radius of the arc, and the orientation of the
//! shape may vary. Any shape of edge is built from corners.
//!
//! The shape of a corner can be fully-specified by two points: The horizontal end, and the vertical
//! end.
//!
//! In special cases, a corner may be *trivial*: It may have a radius of zero, in which case either
//! the horizontal or vertical end will not be in the usual orientation. The layout algorithm only
//! produces trivial corners when the source is directly in line with the target, or in some cases
//! when subdividing a corner (see [Partial edges] below).
//!
//! # Junction points
//!
//!              3
//!   1         /
//!    \    ╭─────╮
//!     ────╯\     \
//!           2     4
//!
//! The layout algorithm doesn't directly place corners. The layout algorithm places a sequence of
//! junction points--coordinates where two horizontal corner ends or two vertical corner ends meet
//! (or just one corner end, at an end of an edge). A series of junction points, always alternating
//! horizontal/vertical, has a one-to-one relationship with a sequence of corners.
//!
//! # Partial edges
//!
//! Corners are sufficient to draw any complete edge; however, in order to split an edge into a
//! focused portion and an unfocused portion at an arbitrary location based on the mouse position,
//! we need to subdivide one of the corners of the edge.
//!
//!                  |\
//!                  | 3
//!                 /
//!               .'
//!  ..........-'
//!  \    \
//!   1    2 (split)
//!
//! When the split position is on the straight segment of a corner, the corner can simply be split
//! into a corner with a shorter segment (2-3), and a trivial corner consisting only of a straight
//! segment (1-2).
//!
//!                  |\
//!                  | 4
//!                 /
//!               .'
//!  ..........-'  \
//!  \         \    3 (split)
//!   1         2
//!
//! The difficult case is when the split position is on the arc. In this case, it is not possible to
//! draw the split using the same [`Rectangle`] shader that is used for everything else; a
//! specialized shape is used which supports drawing arbitrary-angle arcs. A trivial corner will
//! draw the straight line up to the beginning of the arc (1-2); arc shapes will draw the split arc
//! (2-3) and (3-4).

use super::*;



// =================
// === Constants ===
// =================

const MAX_RADIUS: f32 = 20.0;
/// Minimum height above the target the edge must approach it from.
const MIN_APPROACH_HEIGHT: f32 = 32.25;
const NODE_HEIGHT: f32 = crate::component::node::HEIGHT;
/// Extra distance toward the inside of the source node the edge should originate, relative to
/// the point along the y-axis where the node begins to be rounded.
const SOURCE_INSET: f32 = 8.0;
const NODE_CORNER_RADIUS: f32 = crate::component::node::CORNER_RADIUS;



// =======================
// === Junction points ===
// =======================

/// Calculate the start and end positions of each 1-corner section composing an edge to the
/// given offset. Return the points, the maximum radius that should be used to draw the corners
/// connecting them, and the length of the target attachment bit.
pub(super) fn junction_points(
    source_half_width: f32,
    target: Vector2,
    target_attached: bool,
) -> (Vec<Vector2>, f32, Option<f32>) {
    // The maximum x-distance from the source (our local coordinate origin) for the point where the
    // edge will begin.
    let source_max_x_offset = (source_half_width - NODE_CORNER_RADIUS - SOURCE_INSET).max(0.0);
    // The maximum y-length of the target-attachment segment. If the layout allows, the
    // target-attachment segment will fully exit the node before the first corner begins.
    let target_max_attachment_height = target_attached.then_some(NODE_HEIGHT / 2.0);
    if target.y() + target_max_attachment_height.unwrap_or_default() <= -MIN_APPROACH_HEIGHT
        || (target.y() <= 0.0 && target.x().abs() <= source_max_x_offset + 3.0 * MAX_RADIUS)
    {
        // === One corner ===

        // The edge can originate anywhere along the length of the node.
        let source_x = target.x().clamp(-source_max_x_offset, source_max_x_offset);
        let source = Vector2(source_x, 0.0);
        let max_radius = 1000000.0;
        // The target attachment will extend as far toward the edge of the node as it can without
        // rising above the source.
        let attachment_height = target_max_attachment_height.map(|dy| min(dy, target.y().abs()));
        let attachment_y = target.y() + attachment_height.unwrap_or_default();
        let target_attachment = Vector2(target.x(), attachment_y);
        (vec![source, target_attachment], max_radius, attachment_height)
    } else {
        // === Three corners ===

        // The edge originates from either side of the node.
        let source_x = source_half_width.copysign(target.x());
        let distance_x = (target.x() - source_x).abs();
        let top = target.y() + MIN_APPROACH_HEIGHT + NODE_HEIGHT / 2.0;
        let (j0_x, j1_x);
        if distance_x >= 2.0 * MAX_RADIUS && target.x().abs() > source_x.abs() {
            //               J1
            //              /
            //            ╭──────╮
            // ╭─────╮    │      ▢
            // ╰─────╯────╯\
            //             J0
            // Junctions (J0, J1) are in between source and target.
            let source_side_sections_extra_x = (distance_x / 3.0).min(MAX_RADIUS);
            j0_x = source_x + source_side_sections_extra_x.copysign(target.x());
            j1_x = source_x + 2.0 * source_side_sections_extra_x.copysign(target.x());
        } else {
            //            J1
            //           /
            //     ╭──────╮ J0
            //     ▢      │/
            // ╭─────╮    │
            // ╰─────╯────╯
            // J0 > source; J0 > J1; J1 > target.
            j1_x = target.x() + MAX_RADIUS.copysign(target.x());
            let j0_beyond_target = target.x().abs() + MAX_RADIUS * 2.0;
            let j0_beyond_source = source_x.abs() + MAX_RADIUS;
            j0_x = j0_beyond_source.max(j0_beyond_target).copysign(target.x());
        }
        let source = Vector2(source_x, 0.0);
        let j0 = Vector2(j0_x, top / 2.0);
        let j1 = Vector2(j1_x, top);
        // The corners meet the target attachment at the top of the node.
        let attachment_height = target_max_attachment_height.unwrap_or_default();
        let target_attachment = target + Vector2(0.0, attachment_height);
        (vec![source, j0, j1, target_attachment], MAX_RADIUS, Some(attachment_height))
    }
}



// ==================
// === End points ===
// ==================

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub(super) enum EndPoint {
    Source,
    Target,
}



// =======================
// === Splitting edges ===
// =======================

#[derive(Debug, Copy, Clone, PartialEq)]
pub(super) struct EdgeSplit {
    pub corner_index: usize,
    pub closer_end:   EndPoint,
    pub split_corner: SplitCorner,
}

/// Find a point along the edge. Return the index of the corner the point occurs in, and which end
/// is closer to the point, and information about how the corner under the point has been split.
///
/// Returns [`None`] if the point is not on the edge.
pub(super) fn find_position(
    position: ParentCoords,
    corners: &[Oriented<Corner>],
    source_height: f32,
    attachment_height: Option<f32>,
    input_width: f32,
) -> Option<EdgeSplit> {
    let position = *position;
    let corner_index = corners
        .iter()
        .position(|&corner| corner.bounding_box(input_width).contains_inclusive(position))?;
    let split_corner = corners[corner_index].split(position, input_width)?;
    let (full_corners, following_corners) = corners.split_at(corner_index);
    let full_corners_distance: f32 =
        full_corners.iter().map(|&corner| corner.rectilinear_length()).sum();
    let following_distance: f32 =
        following_corners.iter().map(|&corner| corner.rectilinear_length()).sum();
    let target_attachment_distance = attachment_height.unwrap_or_default();
    // The source end of the edge is on a horizontal line through the center of the source node
    // (this gives nice behavior when the edge exits the end at an angle). To accurately determine
    // which end a point appears closer to, we must exclude the portion of the edge that is hidden
    // under the source node.
    let hidden_source_distance = source_height / 2.0;
    let total_distance = full_corners_distance + following_distance - hidden_source_distance
        + target_attachment_distance;
    let offset_from_partial_corner = position - corners[corner_index].source_end();
    let partial_corner_distance =
        offset_from_partial_corner.x().abs() + offset_from_partial_corner.y().abs();
    let distance_from_source =
        full_corners_distance + partial_corner_distance - hidden_source_distance;
    let closer_end = match distance_from_source * 2.0 < total_distance {
        true => EndPoint::Source,
        false => EndPoint::Target,
    };
    Some(EdgeSplit { corner_index, closer_end, split_corner })
}



// ======================================
// === Connecting points with corners ===
// ======================================

pub(super) fn corners(
    points: &[Vector2],
    max_radius: f32,
) -> impl Iterator<Item = Oriented<Corner>> + '_ {
    let mut next_direction = CornerDirection::HorizontalToVertical;
    points.array_windows().map(move |&[p0, p1]| {
        let direction = next_direction;
        next_direction = next_direction.reverse();
        let corner = match direction {
            CornerDirection::HorizontalToVertical =>
                Corner { horizontal: p0, vertical: p1, max_radius },
            CornerDirection::VerticalToHorizontal =>
                Corner { horizontal: p1, vertical: p0, max_radius },
        };
        Oriented::new(corner, direction)
    })
}



// ==============
// === Corner ===
// ==============

#[derive(Debug, Copy, Clone, PartialEq)]
pub(super) struct Corner {
    horizontal: Vector2,
    vertical:   Vector2,
    max_radius: f32,
}

impl Corner {
    /// Return [`Rectangle`] geometry parameters to draw this corner shape.
    pub(super) fn to_rectangle_geometry(self, line_width: f32) -> RectangleGeometry {
        RectangleGeometry {
            clip:   self.clip(),
            size:   self.size(line_width),
            xy:     self.origin(line_width),
            radius: self.max_radius,
        }
    }

    #[inline]
    pub(super) fn clip(self) -> Vector2 {
        let Corner { horizontal, vertical, .. } = self;
        let (dx, dy) = (vertical.x() - horizontal.x(), horizontal.y() - vertical.y());
        let (x_clip, y_clip) = (0.5f32.copysign(dx), 0.5f32.copysign(dy));
        Vector2(x_clip, y_clip)
    }

    #[inline]
    pub(super) fn origin(self, line_width: f32) -> Vector2 {
        let Corner { horizontal, vertical, .. } = self;
        let x = horizontal.x().min(vertical.x() - line_width / 2.0);
        let y = vertical.y().min(horizontal.y() - line_width / 2.0);
        Vector2(x, y)
    }

    #[inline]
    pub(super) fn size(self, line_width: f32) -> Vector2 {
        let Corner { horizontal, vertical, .. } = self;
        let offset = horizontal - vertical;
        let width = (offset.x().abs() + line_width / 2.0).max(line_width);
        let height = (offset.y().abs() + line_width / 2.0).max(line_width);
        Vector2(width, height)
    }

    pub(super) fn bounding_box(self, line_width: f32) -> BoundingBox {
        let origin = self.origin(line_width);
        let size = self.size(line_width);
        BoundingBox::from_position_and_size_unchecked(origin, size)
    }

    #[allow(unused)]
    pub(super) fn euclidean_length(self) -> f32 {
        let Corner { horizontal, vertical, max_radius } = self;
        let offset = horizontal - vertical;
        let (dx, dy) = (offset.x().abs(), offset.y().abs());
        let radius = min(dx, dy).min(max_radius);
        let linear_x = dx - radius;
        let linear_y = dy - radius;
        let arc = std::f32::consts::FRAC_PI_2 * radius;
        arc + linear_x + linear_y
    }

    pub(super) fn rectilinear_length(self) -> f32 {
        let Corner { horizontal, vertical, .. } = self;
        let offset = horizontal - vertical;
        offset.x().abs() + offset.y().abs()
    }

    #[allow(unused)]
    pub(super) fn transpose(self) -> Self {
        let Corner { horizontal, vertical, max_radius } = self;
        Corner { horizontal: vertical.yx(), vertical: horizontal.yx(), max_radius }
    }

    pub(super) fn vertical_end_angle(self) -> f32 {
        match self.vertical.x() > self.horizontal.x() {
            true => 0.0,
            false => std::f32::consts::PI.copysign(self.horizontal.y() - self.vertical.y()),
        }
    }

    pub(super) fn horizontal_end_angle(self) -> f32 {
        std::f32::consts::FRAC_PI_2.copysign(self.horizontal.y() - self.vertical.y())
    }
}


// === Rectangle geometry describing a corner ===

#[derive(Debug, Copy, Clone, Default)]
pub(super) struct RectangleGeometry {
    pub clip:   Vector2,
    pub size:   Vector2,
    pub xy:     Vector2,
    pub radius: f32,
}


// === Parameters for drawing the arc portion of a corner in two parts ===

#[derive(Debug, Copy, Clone, Default, PartialEq)]
pub(super) struct SplitArc {
    pub origin:           Vector2,
    pub radius:           f32,
    pub source_end_angle: f32,
    pub split_angle:      f32,
    pub target_end_angle: f32,
}



// ========================
// === Oriented corners ===
// ========================

#[derive(Debug, Copy, Clone, Deref, PartialEq)]
pub(super) struct Oriented<T> {
    #[deref]
    value:     T,
    direction: CornerDirection,
}

impl<T> Oriented<T> {
    pub(super) fn new(value: T, direction: CornerDirection) -> Self {
        Self { value, direction }
    }
}

impl Oriented<Corner> {
    pub(super) fn source_end(self) -> Vector2 {
        match self.direction {
            CornerDirection::VerticalToHorizontal => self.value.vertical,
            CornerDirection::HorizontalToVertical => self.value.horizontal,
        }
    }

    #[allow(unused)]
    pub(super) fn target_end(self) -> Vector2 {
        match self.direction {
            CornerDirection::VerticalToHorizontal => self.value.horizontal,
            CornerDirection::HorizontalToVertical => self.value.vertical,
        }
    }

    pub(super) fn with_target_end(mut self, value: Vector2) -> Self {
        *(match self.direction {
            CornerDirection::VerticalToHorizontal => &mut self.value.horizontal,
            CornerDirection::HorizontalToVertical => &mut self.value.vertical,
        }) = value;
        self
    }

    pub(super) fn with_source_end(mut self, value: Vector2) -> Self {
        *(match self.direction {
            CornerDirection::VerticalToHorizontal => &mut self.value.vertical,
            CornerDirection::HorizontalToVertical => &mut self.value.horizontal,
        }) = value;
        self
    }

    pub(super) fn reverse(self) -> Self {
        let Self { value, direction } = self;
        let direction = direction.reverse();
        Self { value, direction }
    }

    /// Split the shape at the given point, if the point is within the tolerance specified by
    /// `snap_line_width` of the shape.
    pub(super) fn split(self, split_point: Vector2, snap_line_width: f32) -> Option<SplitCorner> {
        let Corner { horizontal, vertical, max_radius } = self.value;
        let hv_offset = horizontal - vertical;
        let (dx, dy) = (hv_offset.x().abs(), hv_offset.y().abs());
        let radius = min(dx, dy).min(max_radius);

        // Calculate closeness to the straight segments.
        let (linear_x, linear_y) = (dx - radius, dy - radius);
        let snap_distance = snap_line_width / 2.0;
        let y_along_vertical = (self.vertical.y() - split_point.y()).abs() <= linear_y;
        let x_along_horizontal = (self.horizontal.x() - split_point.x()).abs() <= linear_x;
        let y_near_horizontal = (self.horizontal.y() - split_point.y()).abs() <= snap_distance;
        let x_near_vertical = (self.vertical.x() - split_point.x()).abs() <= snap_distance;

        // Calculate closeness to the arc.
        // 1. Find the origin of the circle the arc is part of.
        // The corner of our bounding box that is immediately outside the arc.
        let point_outside_arc = Vector2(self.vertical.x(), self.horizontal.y());
        // The opposite corner of our bounding box, far inside the arc.
        // Used to find the direction from outside the arc to the origin of the arc's circle.
        let point_inside_arc = Vector2(self.horizontal.x(), self.vertical.y());
        let outside_to_inside = point_inside_arc - point_outside_arc;
        let outside_to_origin =
            Vector2(radius.copysign(outside_to_inside.x()), radius.copysign(outside_to_inside.y()));
        let origin = point_outside_arc + outside_to_origin;
        // 2. Check if the point is on the arc.
        let input_to_origin = split_point - origin;
        let distance_squared_from_origin =
            input_to_origin.x().powi(2) + input_to_origin.y().powi(2);
        let min_radius = radius - snap_line_width / 2.0;
        let max_radius = radius + snap_line_width / 2.0;
        let too_close = distance_squared_from_origin < min_radius.powi(2);
        let too_far = distance_squared_from_origin > max_radius.powi(2);
        let on_arc = !(too_close || too_far);

        if y_near_horizontal && x_along_horizontal {
            // The point is along the horizontal line. Snap its y-value, and draw a corner to it.
            let snapped = Vector2(split_point.x(), self.horizontal.y());
            let source_end = self.with_target_end(snapped);
            let target_end = self.with_source_end(snapped);
            Some(SplitCorner { source_end, target_end, split_arc: None })
        } else if x_near_vertical && y_along_vertical {
            // The point is along the vertical line. Snap its x-value, and draw a corner to it.
            let snapped = Vector2(self.vertical.x(), split_point.y());
            let source_end = self.with_target_end(snapped);
            let target_end = self.with_source_end(snapped);
            Some(SplitCorner { source_end, target_end, split_arc: None })
        } else if on_arc {
            // Find the input point's angle along the arc.
            let offset_from_origin = split_point - origin;
            let split_angle = offset_from_origin.y().atan2(offset_from_origin.x());
            // Split the arc on the angle.
            let arc_horizontal_end = origin - Vector2(0.0, radius.copysign(outside_to_inside.y()));
            let arc_vertical_end = origin - Vector2(radius.copysign(outside_to_inside.x()), 0.0);
            let (arc_begin, arc_end) = match self.direction {
                CornerDirection::HorizontalToVertical => (arc_horizontal_end, arc_vertical_end),
                CornerDirection::VerticalToHorizontal => (arc_vertical_end, arc_horizontal_end),
            };
            let source_end = self.with_target_end(arc_begin);
            let target_end = self.with_source_end(arc_end);
            let source_end_angle = self.source_end_angle();
            let target_end_angle = self.target_end_angle();
            // Snap the angle to the arc's quadrant, so that the signs don't come out wrong if we
            // handle an event slightly outside the expected bounds.
            let (low, high) = match source_end_angle < target_end_angle {
                true => (source_end_angle, target_end_angle),
                false => (target_end_angle, source_end_angle),
            };
            let split_angle = split_angle.clamp(low, high);
            let split =
                SplitArc { origin, radius, source_end_angle, split_angle, target_end_angle };
            Some(SplitCorner { source_end, target_end, split_arc: Some(split) })
        } else {
            None
        }
    }

    pub(super) fn source_end_angle(self) -> f32 {
        match self.direction {
            CornerDirection::HorizontalToVertical => self.horizontal_end_angle(),
            CornerDirection::VerticalToHorizontal => self.vertical_end_angle(),
        }
    }

    pub(super) fn target_end_angle(self) -> f32 {
        self.reverse().source_end_angle()
    }
}


// === Corner direction ===

#[derive(Debug, Copy, Clone, PartialEq)]
pub(super) enum CornerDirection {
    HorizontalToVertical,
    VerticalToHorizontal,
}

impl CornerDirection {
    pub(super) fn reverse(self) -> Self {
        match self {
            CornerDirection::HorizontalToVertical => CornerDirection::VerticalToHorizontal,
            CornerDirection::VerticalToHorizontal => CornerDirection::HorizontalToVertical,
        }
    }
}


// === Split (oriented) corners ====

#[derive(Debug, Copy, Clone, PartialEq)]
pub(super) struct SplitCorner {
    pub source_end: Oriented<Corner>,
    pub target_end: Oriented<Corner>,
    pub split_arc:  Option<SplitArc>,
}
