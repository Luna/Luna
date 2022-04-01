package org.enso.table.aggregations;

import org.enso.table.data.column.storage.Storage;
import org.enso.table.data.table.Column;
import org.enso.table.data.table.problems.InvalidAggregation;

import java.util.List;

/***
 * Aggregate Column computing the mean value in a group.
 */
public class Mean extends AggregateColumn {
  private static class Calculation {
    public long count;
    public double total;

    public Calculation(double value) {
      count = 1;
      total = value;
    }
  }

  private final Storage storage;

  public Mean(String name, Column column) {
    super(name, Storage.Type.DOUBLE);
    this.storage = column.getStorage();
  }

  @Override
  public Object aggregate(List<Integer> rows) {
    Calculation current = null;
    for (int row: rows) {
      Object value = storage.getItemBoxed(row);
      if (value != null) {
        Double dValue = CastToDouble(value);
        if (dValue == null) {
          this.addProblem(new InvalidAggregation(this.getName(), row, "Cannot convert to a Double."));
          return null;
        }

        if (current == null) {
          current = new Calculation(dValue);
        } else {
          current.count++;
          current.total += dValue;
        }
      }
    }
    return current == null ? null : current.total / current.count;
  }
}
