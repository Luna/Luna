package org.enso.table.data.table.aggregate;

import org.enso.table.data.column.storage.Storage;
import org.enso.table.data.index.MultiValueKey;
import org.enso.table.data.table.Column;

import com.ibm.icu.text.BreakIterator;
import org.enso.table.data.table.problems.InvalidAggregation;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.HashSet;
import java.util.Map;
import java.util.HashMap;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

public class AggregateColumnDefinition {
  @FunctionalInterface
  private interface Aggregator {
    Object aggregate(List<Integer> rows);
  }

  private final String name;
  private final int type;
  private final Aggregator aggregator;

  private AggregateColumnDefinition(String name, int type, Aggregator aggregator) {
    this.name = name;
    this.type = type;
    this.aggregator = aggregator;
  }

  public String getName() {
    return name;
  }

  public int getType() {
    return type;
  }

  public Object aggregate(int[] rows) {
    return this.aggregate(IntStream.of(rows).boxed().collect(Collectors.toList()));
  }

  public Object aggregate(List<Integer> rows) {
    return this.aggregator.aggregate(rows);
  }

  private static long GraphemeLength(String text) {
    BreakIterator iter = BreakIterator.getCharacterInstance();
    iter.setText(text);

    int count = 0;
    for (int end = iter.next(); end != BreakIterator.DONE; end = iter.next()) {
      count++;
    }

    return count;
  }

  private static Long CastToLong(Object value) {
    if (value instanceof Long) {
      return (Long)value;
    } else if (value instanceof Integer) {
      return ((Integer)value).longValue();
    } else if (value instanceof Byte) {
      return ((Byte)value).longValue();
    } else if (value instanceof Float && ((Float)value) % 1 == 0) {
      return ((Float)value).longValue();
    } else if (value instanceof Double && ((Double)value) % 1 == 0) {
      return ((Double)value).longValue();
    }

    return null;
  }

  private static Double CastToDouble(Object value) {
    if (value instanceof Long) {
      return ((Long)value).doubleValue();
    } else if (value instanceof Integer) {
      return ((Integer)value).doubleValue();
    } else if (value instanceof Byte) {
      return ((Byte)value).doubleValue();
    } else if (value instanceof Float) {
      return ((Float)value).doubleValue();
    } else if (value instanceof Double) {
      return ((Double)value);
    }

    return null;
  }

  private static String ToQuotedString(Object value, final String quote, final String join) {
    if (value == null) {
      return "";
    }

    String textValue = value.toString();
    if (!quote.equals("") && (textValue.equals("") || textValue.contains(join))) {
      return quote + textValue.replace(quote, quote + quote) + quote;
    }

    return textValue;
  }

  private static int Compare(Object current, Object value) {
    if (current instanceof String && value instanceof String) {
      return ((String)value).compareTo((String)current);
    }

    if (current instanceof Long) {
      Long lValue = CastToLong(value);
      if (null != lValue) {
        return Long.compare(lValue, (Long)current);
      }

      Double dValue = CastToDouble(value);
      if (null != dValue) {
        return Double.compare(dValue, (Long)current);
      }
    }

    if (current instanceof Double) {
      Double dValue = CastToDouble(value);
      if (null != dValue) {
        return Double.compare(dValue, (Double)current);
      }
    }

    throw new ClassCastException();
  }

  public static AggregateColumnDefinition GroupBy(String name, Column column) {
    Storage storage = column.getStorage();
    return new AggregateColumnDefinition(
        name,
        Storage.Type.OBJECT,
        (rows) -> rows.isEmpty() ? null : storage.getItemBoxed(rows.get(0)));
  }

  public static AggregateColumnDefinition Count(String name) {
    return new AggregateColumnDefinition(name, Storage.Type.LONG, List::size);
  }

  public static AggregateColumnDefinition CountNothing(String name, Column column, boolean isNothing) {
    Storage storage = column.getStorage();
    return new AggregateColumnDefinition(
        name,
        Storage.Type.LONG,
        rows -> {
            int count = 0;
            for (int row: rows) {
              count += ((storage.getItemBoxed(row) == null) == isNothing ? 1 : 0);
            }
            return count;
        });
  }

  public static AggregateColumnDefinition CountEmpty(String name, Column column, boolean isEmpty) {
    Storage storage = column.getStorage();
    return new AggregateColumnDefinition(
        name,
        Storage.Type.LONG,
        rows -> {
          int count = 0;
          for (int row: rows) {
            Object value = storage.getItemBoxed(row);
            if (value != null && !(value instanceof String)) {
              return new InvalidAggregation(name, row, "Non-Text value - cannot Count " + (isEmpty ? "Empty" : "Non-Empty"));
            }

            count += ((value == null || ((String)value).length() == 0) == isEmpty ? 1 : 0);
          }
          return count;
        });
  }

  public static AggregateColumnDefinition CountDistinct(String name, Column[] columns, boolean ignoreEmpty) {
    Storage[] storage = Arrays.stream(columns).map(Column::getStorage).toArray(Storage[]::new);
    return new AggregateColumnDefinition(
        name,
        Storage.Type.LONG,
        rows -> {
          Set<MultiValueKey> set = new HashSet<>();
          for (int row: rows) {
            MultiValueKey key = new MultiValueKey(Arrays.stream(storage).map(s->s.getItemBoxed(row)).toArray());
            if (!ignoreEmpty || !key.areAllNull()) {
              set.add(key);
            }
          }
          return set.size();
        });
  }

  public static AggregateColumnDefinition MinOrMax(String name, Column column, int minOrMax) {
    Storage storage = column.getStorage();
    return new AggregateColumnDefinition(
        name,
        Storage.Type.OBJECT,
        rows -> {
          Object current = null;
          for (int row: rows) {
            Object value = storage.getItemBoxed(row);
            if (value != null) {
              try {
                if (current == null || Compare(current, value) == minOrMax) {
                  current = value;
                }
              } catch (ClassCastException e) {
                return new InvalidAggregation(name, row, "Cannot Compare Values.");
              }
            }
          }
          return current;
        });
  }

  public static AggregateColumnDefinition MinOrMaxLength(String name, Column column, int minOrMax) {
    Storage storage = column.getStorage();

    return new AggregateColumnDefinition(
        name,
        Storage.Type.STRING,
        rows -> {
          long length = 0;
          Object current = null;

          for (int row: rows) {
            Object value = storage.getItemBoxed(row);
            if (value != null) {
              if (!(value instanceof String)) {
                return new InvalidAggregation(name, row, "Non-Text value - cannot find " + (minOrMax == 1 ? "Longest" : "Shortest"));
              }

              long valueLength = GraphemeLength((String)value);
              if (current == null || Long.compare(valueLength, length) == minOrMax) {
                length = valueLength;
                current = value;
              }
            }
          }

          return current;
        });
  }

  public static AggregateColumnDefinition Sum(String name, Column column) {
    Storage storage = column.getStorage();
    return new AggregateColumnDefinition(
        name,
        Storage.Type.OBJECT,
        rows -> {
          Object current = null;
          for (int row: rows) {
            Object value = storage.getItemBoxed(row);
            if (value != null) {
              if (current == null) {
                current = value;
              } else {
                Long lCurrent = CastToLong(current);
                Long lValue = CastToLong(value);
                if (lCurrent != null && lValue != null) {
                  current = lCurrent + lValue;
                } else {
                  Double dCurrent = CastToDouble(current);
                  Double dValue = CastToDouble(value);
                  if (dCurrent != null && dValue != null) {
                    current = dCurrent + dValue;
                  } else {
                    return new InvalidAggregation(name, row, "Cannot Total Values.");
                  }
                }
              }
            }
          }
          return current;
        });
  }

  public static AggregateColumnDefinition Mean(String name, Column column) {
    class MeanCalculation {
      public long count;
      public double total;

      public MeanCalculation(double value) {
        count = 1;
        total = value;
      }
    }

    Storage storage = column.getStorage();
    return new AggregateColumnDefinition(
        name,
        Storage.Type.OBJECT,
        rows -> {
          MeanCalculation current = null;
          for (int row: rows) {
            Object value = storage.getItemBoxed(row);
            if (value != null) {
              Double dValue = CastToDouble(value);
              if (dValue == null) {
                return new InvalidAggregation(name, row, "Cannot convert to a Double.");
              }

              if (current == null) {
                current = new MeanCalculation(dValue);
              } else {
                current.count++;
                current.total += dValue;
              }
            }
          }
          return current == null ? null : current.total / current.count;
        });
  }

  public static AggregateColumnDefinition StDev(String name, Column column, boolean population) {
    class StDevCalculation {
      public long count;
      public double total;
      public double total_sqr;

      public StDevCalculation(double value) {
        count = 1;
        total = value;
        total_sqr = value * value;
      }
    }

    Storage storage = column.getStorage();
    return new AggregateColumnDefinition(
        name,
        Storage.Type.OBJECT,
        rows -> {
          StDevCalculation current = null;
          for (int row: rows) {
            Object value = storage.getItemBoxed(row);
            if (value != null) {
              Double dValue = CastToDouble(value);
              if (dValue == null) {
                return new InvalidAggregation(name, row, "Cannot convert to a Double.");
              }

              if (current == null) {
                current = new StDevCalculation(dValue);
              } else {
                current.count++;
                current.total += dValue;
                current.total_sqr += dValue*dValue;
              }
            }
          }
          return current == null ? null :
              (population ? 1 : Math.sqrt(current.count / (current.count - 1.0))) *
                  Math.sqrt(current.total_sqr / current.count - Math.pow(current.total / current.count, 2));
        });
  }

  public static AggregateColumnDefinition First(String name, Column column, boolean ignoreNothing) {
    Storage storage = column.getStorage();
    return new AggregateColumnDefinition(
        name,
        Storage.Type.OBJECT,
        rows -> {
          for (int row: rows) {
            Object value = storage.getItemBoxed(row);
            if (!ignoreNothing || value != null) {
              return value;
            }
          }
          return null;
        });
  }

  public static AggregateColumnDefinition Last(String name, Column column, boolean ignoreNothing) {
    Storage storage = column.getStorage();
    return new AggregateColumnDefinition(
        name,
        Storage.Type.OBJECT,
        rows -> {
          Object current = null;
          for (int row: rows) {
            Object value = storage.getItemBoxed(row);
            if (!ignoreNothing || value != null) {
              current = value;
            }
          }
          return current;
        });
  }

  public static AggregateColumnDefinition Concatenate(String name, Column column, String join, final String prefix, final String suffix, String quote){
    final String finalJoin = join == null ? "" : join;
    final String finalQuote = quote == null ? "" : quote;

    Storage storage = column.getStorage();
    return new AggregateColumnDefinition(
        name,
        Storage.Type.STRING,
        rows -> {
          StringBuilder current = null;
          for (int row: rows) {
            Object value = storage.getItemBoxed(row);
            if (value == null || value instanceof String) {
              String textValue = ToQuotedString(value, finalQuote, finalJoin);
              if (current == null) {
                current = new StringBuilder();
                current.append(textValue);
              } else {
                current.append(finalJoin);
                current.append(textValue);
              }
            } else {
              return new InvalidAggregation(name, row, "Non-Text value - cannot Concatenate");
            }
          }

          if (current == null) {
            return null;
          }

          if (prefix != null) { current.insert(0, prefix); }
          current.append(suffix);
          return current.toString();
        });
  }

  public static AggregateColumnDefinition Mode(String name, Column column) {
    Storage storage = column.getStorage();
    return new AggregateColumnDefinition(
        name,
        Storage.Type.OBJECT,
        rows -> {
          Object current = null;
          int count = 0;
          Map<Object, Integer> currentMap = null;
          for (int row: rows) {
            Object value = storage.getItemBoxed(row);
            if (value != null) {
              // Merge all numbers onto Double
              Double dValue = CastToDouble(value);
              value = dValue == null ? value : dValue;

              if (current == null) {
                current = value;
                count = 1;
                currentMap = new HashMap<>();
                currentMap.put(value, 1);
              } else {
                int newCount = currentMap.getOrDefault(value, 0) + 1;
                currentMap.put(value, newCount);
                if (newCount > count) {
                  count = newCount;
                  current = value;
                }
              }
            }
          }
          return current;
        });
  }
}
