package org.enso.table.data.column.operation;

public class CastProblemBuilder {
  private int failedConversionsCount = 0;

  public void reportConversionFailure() {
    failedConversionsCount++;
  }

  public int getFailedConversionsCount() {
    return failedConversionsCount;
  }
}
