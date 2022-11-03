//! A cache that stores a grid of items. The cache contains a grid of items, and aa padding around
//! the inner grid. The padding is used to store items that are expected to be accessed soon.  
//! Once an item outside of the inner grid is requested, the position of the inner grids is moved
//! and new items are requested to the cache.
//!
//! Example
//! -------
//! Consider a grid of the sie 4x1, where the current visible window is at position (0,0) and has
//! the size 2x1, with a padding of 1. The cache will contain the following items:
//! ```text
//! +---+---+---+---+---+
//! | 1 | 2 | 3 |   |   |
//! +---+---+---+---+---+
//! ```
//! Any access to item (0,0) or (1,0), will return the items content and not affect the cache.
//! Access to item (2,0) will move the inner grid to position (1,0) and request a new item for
//! position (3,0). The cache will then look like this:
//! ```text
//! +---+---+---+---+---+
//! | 1 | 2 | 3 | 4 |   |
//! +---+---+---+---+---+
//! ```
//! The item at position (0,0) is now outside of the inner grid but will be kept due to the padding.
//! After access to item (0,4) the cache will look like this:
//! ```text
//! +---+---+---+---+---+
//! |   | 2 | 3 | 4 | 5 |
//! +---+---+---+---+---+
//! ```
//! The inner window is now at position (2,0) and the item at position (0,0) is no longer in the
//! case as it is outside of the padded area.

use crate::prelude::*;

use super::GridPosition;
use super::GridSize;
use super::GridVector;
use super::GridWindow;



#[derive(Derivative)]
#[derivative(Debug(bound = ""))]
pub struct GridCache<T> {
    cached_grid_pos:  GridPosition,
    cached_grid_size: GridSize,

    #[derivative(Debug = "ignore")]
    data:          HashMap<GridPosition, T>,
    /// Number of row/columns that should be fetched, which are not visible
    cache_padding: i32,

    #[derivative(Debug = "ignore")]
    request_fn: Box<dyn Fn(GridWindow)>,
}

impl<T: Clone> GridCache<T> {
    pub fn new(
        starting_pos: GridPosition,
        starting_size: GridSize,
        cache_padding: u32,
        request_fn: Box<dyn Fn(GridWindow)>,
    ) -> Self {
        let data = HashMap::new();
        Self {
            cached_grid_pos: starting_pos,
            cached_grid_size: starting_size,
            data,
            cache_padding: cache_padding as i32,
            request_fn,
        }
        .init()
    }

    fn init(self) -> Self {
        let x_start = self.cached_grid_pos.x - self.cache_padding;
        let x_end = self.cached_grid_pos.x + self.cached_grid_size.x + self.cache_padding;

        let y_start = self.cached_grid_pos.y - self.cache_padding;
        let y_end = self.cached_grid_pos.y + self.cached_grid_size.y + self.cache_padding;

        (self.request_fn)(GridWindow {
            position: Vector2::new(x_start, y_start),
            size:     Vector2::new(x_end - x_start, y_end - y_start),
        });
        self
    }

    pub fn get_item(&mut self, index: GridPosition) -> Option<T> {
        self.register_cache_access(index);
        let item = self.data.get(&index).cloned();
        if item.is_none() {
            self.request_data_update();
        }
        item
    }

    pub fn add_item(&mut self, index: GridPosition, item: T) {
        self.data.insert(index, item);
    }

    fn register_cache_access(&mut self, index: GridPosition) {
        if let Some(offset) = self.distance_from_displayed_grid(index) {
            debug_assert!(
                offset != Vector2::new(0, 0),
                "The index {} should not be in the displayed grid with pos {} and size {}",
                index,
                self.cached_grid_pos,
                self.cached_grid_size
            );
            let old_grid_pos: HashSet<_> = self.iter_full_grid().collect();
            self.cached_grid_pos += offset;
            let new_grid: HashSet<_> = self.iter_full_grid().collect();
            let to_remove = old_grid_pos.difference(&new_grid);
            for pos in to_remove {
                self.data.remove(pos);
            }
            self.request_data_update()
        }
    }

    fn request_data_update(&self) {
        (self.request_fn)(self.padded_grid_window());
    }

    fn padded_grid_window(&self) -> GridWindow {
        let delta = GridVector::new(self.cache_padding, self.cache_padding);
        let position = self.cached_grid_pos - delta / 2;
        let size = self.cached_grid_size + delta;

        GridWindow { position, size }
    }

    /// Iterate the full grid including the cached padding.
    fn iter_full_grid(&self) -> impl Iterator<Item = GridPosition> {
        let x_start = self.cached_grid_pos.x - self.cache_padding;
        let x_end = self.cached_grid_pos.x + self.cached_grid_size.x + self.cache_padding;

        let y_start = self.cached_grid_pos.y - self.cache_padding;
        let y_end = self.cached_grid_pos.y + self.cached_grid_size.y + self.cache_padding;

        (x_start..x_end).cartesian_product(y_start..y_end).map(|(x, y)| GridPosition::new(x, y))
    }

    fn distance_from_displayed_grid(&self, index: GridPosition) -> Option<GridVector> {
        let bottom_right = self.cached_grid_pos + self.cached_grid_size;

        if index >= self.cached_grid_pos && index <= bottom_right {
            None
        } else {
            let dx =
                distance_from_segment(self.cached_grid_pos.x, self.cached_grid_size.x, index.x);
            let dy =
                distance_from_segment(self.cached_grid_pos.y, self.cached_grid_size.y, index.y);
            debug_assert!(
                dx != 0 || dy != 0,
                "The index {} should not be in the displayed grid with pos {} and size {}",
                index,
                self.cached_grid_pos,
                self.cached_grid_size
            );
            Some(GridVector::new(dx, dy))
        }
    }
}

fn distance_from_segment(start: i32, size: i32, value: i32) -> i32 {
    let delta = value - start;
    if value >= start && value < start + size {
        0
    } else if delta > 0 {
        delta - size + 1
    } else {
        delta
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_distance_from_segment() {
        assert_eq!(distance_from_segment(0, 2, 0), 0);
        assert_eq!(distance_from_segment(0, 2, 1), 0);
        assert_eq!(distance_from_segment(0, 2, 2), 1);
        assert_eq!(distance_from_segment(0, 2, 3), 2);
        assert_eq!(distance_from_segment(0, 2, 4), 3);
        assert_eq!(distance_from_segment(0, 2, -1), -1);
        assert_eq!(distance_from_segment(0, 2, -2), -2);
        assert_eq!(distance_from_segment(0, 2, -3), -3);


        assert_eq!(distance_from_segment(2, 4, 0), -2);
        assert_eq!(distance_from_segment(2, 4, 1), -1);
        assert_eq!(distance_from_segment(2, 4, 2), 0);
        assert_eq!(distance_from_segment(2, 4, 3), 0);
        assert_eq!(distance_from_segment(2, 4, 4), 0);
        assert_eq!(distance_from_segment(2, 4, 5), 0);
        assert_eq!(distance_from_segment(2, 4, 6), 1);
        assert_eq!(distance_from_segment(2, 4, 7), 2);
    }

    #[test]
    fn test_distance_from_displayed_grid() {
        let sample_cache = GridCache::<u32>::new(
            GridPosition::new(0, 0),
            GridSize::new(2, 2),
            1,
            Box::new(|_| {}),
        );

        assert_eq!(sample_cache.distance_from_displayed_grid(GridPosition::new(0, 0)), None);
        assert_eq!(sample_cache.distance_from_displayed_grid(GridPosition::new(1, 0)), None);
        assert_eq!(sample_cache.distance_from_displayed_grid(GridPosition::new(0, 1)), None);
        assert_eq!(sample_cache.distance_from_displayed_grid(GridPosition::new(1, 1)), None);

        assert_eq!(
            sample_cache.distance_from_displayed_grid(GridPosition::new(2, 0)),
            Some(GridVector::new(1, 0))
        );
        assert_eq!(
            sample_cache.distance_from_displayed_grid(GridPosition::new(0, 2)),
            Some(GridVector::new(0, 1))
        );
        assert_eq!(
            sample_cache.distance_from_displayed_grid(GridPosition::new(2, 2)),
            Some(GridVector::new(1, 1))
        );
        assert_eq!(
            sample_cache.distance_from_displayed_grid(GridPosition::new(-1, 0)),
            Some(GridVector::new(-1, 0))
        );
        assert_eq!(
            sample_cache.distance_from_displayed_grid(GridPosition::new(0, -1)),
            Some(GridVector::new(0, -1))
        );
        assert_eq!(
            sample_cache.distance_from_displayed_grid(GridPosition::new(-1, -1)),
            Some(GridVector::new(-1, -1))
        );
        assert_eq!(
            sample_cache.distance_from_displayed_grid(GridPosition::new(-1, 2)),
            Some(GridVector::new(-1, 1))
        );
    }

    #[test]
    fn test_distance_from_displayed_grid_2() {
        let sample_cache = GridCache::<u32>::new(
            GridPosition::new(0, 2),
            GridSize::new(20, 20),
            0,
            Box::new(|_| {}),
        );

        assert_eq!(sample_cache.distance_from_displayed_grid(GridPosition::new(0, 23)), None);
    }
}
