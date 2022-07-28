//! An algorithm for arranging component groups in the Favorites section in an order that optimizes
//! the keyboard access to them.
//!
//! See [`Layouter`] struct documentation to learn more.

use ensogl_core::prelude::*;



// =================
// === Constants ===
// =================

/// The layouting algorithm works only for three columns, so this constant is just for
/// readability, it can't be easily changed.
const COLUMNS: usize = 3;
const LEFT: usize = 0;
const CENTER: usize = 1;
const RIGHT: usize = 2;
type Column = usize;



// =============
// === Group ===
// =============

type GroupIndex = usize;
type GroupSize = usize;

#[derive(Clone, Copy, Debug)]
pub struct Group {
    pub index: GroupIndex,
    pub size:  GroupSize,
}



// ================
// === Layouter ===
// ================

/// This struct contains a state needed for the layouting algorithm. The algorithm accepts a list
/// of groups with their size and returns a static array of [`COLUMNS`] lists. These lists
/// contain the indices of the component groups that should be displayed in each column, ordered
/// from bottom to top.
///
/// A special arrangment is needed because we want to make the most important groups accesible
/// with the least amount of keystrokes possible.
///
/// The layouting algorithm itself is described in the [design doc]. The order of first 4 groups
/// is predefined: groups 1 and 4 go to the central column, groups 2 and 3 go to the left and right
/// columns, respectively. The order and columns of the rest of the groups is determined by their
/// sizes.
///
/// [design doc]: https://github.com/enso-org/design/blob/main/epics/component-browser/design.md#layouting-algorithm
pub struct Layouter<I: Iterator<Item = Group>> {
    columns: [Vec<GroupIndex>; COLUMNS],
    heights: [GroupSize; COLUMNS],
    iter:    iter::Peekable<I>,
}

impl<I: Iterator<Item = Group>> Layouter<I> {
    #[allow(missing_docs)]
    pub fn new(iter: I) -> Self {
        Self { columns: default(), heights: default(), iter: iter.peekable() }
    }

    /// Calculate the layouting of the groups. See struct documentation for more information.
    pub fn arrange(mut self) -> [Vec<GroupIndex>; COLUMNS] {
        let mut max_height = self.push_next_group_to(CENTER);
        while self.iter.peek().is_some() {
            self.push_next_group_to(LEFT);
            self.push_next_group_to(RIGHT);
            let next_max_height = max_height + self.push_next_group_to(CENTER);

            self.fill_till_height(LEFT, max_height);
            self.fill_till_height(RIGHT, max_height);
            max_height = next_max_height;
        }

        self.columns
    }

    /// Push the next group to the given column. Returns the size of the added group, 0 if no group
    /// was added.
    fn push_next_group_to(&mut self, column: Column) -> GroupSize {
        if let Some(group) = self.iter.next() {
            self.columns[column].push(group.index);
            self.heights[column] += group.size;
            group.size
        } else {
            0
        }
    }

    /// Fill the given column until it reaches the given height.
    fn fill_till_height(&mut self, column: Column, max_height: GroupSize) {
        let column_height = &mut self.heights[column];
        while *column_height < max_height {
            if let Some(group) = self.iter.next() {
                self.columns[column].push(group.index);
                *column_height += group.size;
            } else {
                break;
            }
        }
    }
}



// =============
// === Tests ===
// =============

#[cfg(test)]
mod tests {
    use super::*;

    /// Test that algorithm doesn't panic even with small count of component groups.
    #[test]
    fn test_small_count_of_groups() {
        for count in 0..4 {
            let groups = (0..count).map(|index| Group { index, size: 1 });
            let arranged = Layouter::new(groups).arrange();
            let total_count = arranged[LEFT].len() + arranged[CENTER].len() + arranged[RIGHT].len();
            assert_eq!(total_count, count);
        }
    }

    /// See [design doc](https://github.com/enso-org/design/blob/main/epics/component-browser/design.md#layouting-algorithm).
    #[test]
    fn test_case_from_design_doc() {
        let groups: Vec<(usize, usize)> =
            vec![(1, 4), (2, 4), (3, 3), (4, 3), (5, 2), (6, 3), (7, 2)];
        let groups = groups.into_iter().map(|(index, size)| Group { index, size });
        let arranged = Layouter::new(groups).arrange();
        let expected: &[Vec<usize>] = &[vec![2, 6], vec![1, 4], vec![3, 5, 7]];
        assert_eq!(&arranged, expected);
    }

    /// See [task #181431035](https://www.pivotaltracker.com/story/show/181431035).
    #[test]
    fn test_case_from_acceptance_criteria() {
        let groups: Vec<(usize, usize)> =
            vec![(1, 3), (2, 1), (3, 3), (4, 4), (5, 1), (6, 1), (7, 4), (8, 1), (9, 2), (10, 1)];
        let groups = groups.into_iter().map(|(index, size)| Group { index, size });
        let arranged = Layouter::new(groups).arrange();
        let expected: &[Vec<usize>] = &[vec![2, 5, 6, 7], vec![1, 4, 9], vec![3, 8, 10]];
        assert_eq!(&arranged, expected);
    }
}
