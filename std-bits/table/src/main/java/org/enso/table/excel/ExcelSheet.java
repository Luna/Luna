package org.enso.table.excel;

import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;

import java.util.function.IntFunction;

/** Wrapper class to handle Excel sheets. */
public class ExcelSheet {
  private final int firstRow;
  private final int lastRow;
  private final boolean use1904Format;

  // Still to re-work
  private final IntFunction<Row> rowSupplier;
  private final Sheet sheet;

  public ExcelSheet(Workbook workbook, int sheetIndex) {
    this(
        workbook.getSheetAt(sheetIndex).getFirstRowNum() + 1,
        workbook.getSheetAt(sheetIndex).getLastRowNum() + 1,
        workbook.getSheetAt(sheetIndex)::getRow,
        workbook.getSheetAt(sheetIndex));
  }

  public ExcelSheet(int firstRow, int lastRow, IntFunction<Row> rowSupplier, Sheet sheet) {
    this.firstRow = firstRow;
    this.lastRow = lastRow;
    this.rowSupplier = rowSupplier;
    this.use1904Format = ExcelUtils.is1904DateSystem(workbook);
    this.sheet = sheet;
  }

  public int getLastRow() {
    return lastRow;
  }

  public int getFirstRow() {
    return firstRow;
  }

  public ExcelRow get(int row) {
    Row underlyingRow = row < firstRow || row > lastRow ? null : rowSupplier.apply(row - 1);
    return underlyingRow == null ? null : new ExcelRow(underlyingRow, use1904Format);
  }

  public Sheet getSheet() {
    return sheet;
  }
}
