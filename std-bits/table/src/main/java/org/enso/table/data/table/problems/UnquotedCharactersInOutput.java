package org.enso.table.data.table.problems;

public class UnquotedCharactersInOutput extends ColumnAggregatedProblem {
  public UnquotedCharactersInOutput(String columnName, int row) {
    super(columnName, row);
  }

  @Override
  public boolean merge(ColumnAggregatedProblem another) {
    if (another instanceof UnquotedCharactersInOutput
        && this.getLocationName().equals(another.getLocationName())) {
      this.rows.addAll(another.rows);
      return true;
    }

    return false;
  }
}
