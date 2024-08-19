package org.enso.table.excel;

import org.apache.poi.ss.usermodel.Name;

/**
 * Represents an Excel workbook.
 * Wraps the underlying Apache POI Workbook object.
 */
public interface ExcelWorkbook {
  /**
   * Get the number of spreadsheets in the workbook
   *
   * @return the number of sheets
   */
  int getNumberOfSheets();

  /**
   * Returns the index of the sheet by his name
   *
   * @param name the sheet name
   * @return index of the sheet (0 based)
   */
  int getSheetIndex(String name);

  /**
   * Get the sheet name
   *
   * @param sheet sheet number (0 based)
   * @return Sheet name
   */
  String getSheetName(int sheet);

  /**
   * @return the total number of defined names in this workbook
   */
  int getNumberOfNames();

  /**
   * Get all the range names in the workbook
   * @return an array of range names
   */
  String[] getRangeNames();

  /**
   * Get the formula for a named range.
   * @param name the name of the range.
   * @return the formula for the range or null if not found.
   */
  String getNameFormula(String name);

  /**
   * Get a sheet by its index
   * @param sheetIndex the index of the sheet (0 based)
   * @return the sheet as an ExcelSheet object
   */
  ExcelSheet getSheetAt(int sheetIndex);

  /**
   * Create an ExcelWorkbook object from an Apache POI Workbook object
   * @param workbook the Apache POI Workbook object
   * @return the ExcelWorkbook object
   */
  static ExcelWorkbook ForWorkbook(org.apache.poi.ss.usermodel.Workbook workbook) {
    return new ExcelWorkbookForWorkbook(workbook);
  }

  record ExcelWorkbookForWorkbook(org.apache.poi.ss.usermodel.Workbook workbook) implements ExcelWorkbook {
    @Override
    public int getNumberOfSheets() {
      return workbook.getNumberOfSheets();
    }

    @Override
    public int getSheetIndex(String name) {
      return workbook.getSheetIndex(name);
    }

    @Override
    public String getSheetName(int sheet) {
      return workbook.getSheetName(sheet);
    }

    @Override
    public int getNumberOfNames() {
      return workbook.getNumberOfNames();
    }

    @Override
    public String[] getRangeNames() {
      var names = workbook.getAllNames();
      return names.stream().map(Name::getNameName).toArray(String[]::new);
    }

    @Override
    public String getNameFormula(String name) {
      var namedRange = workbook.getName(name);
      return namedRange == null ? null : namedRange.getRefersToFormula();
    }

    @Override
    public ExcelSheet getSheetAt(int sheetIndex) {
      var sheet = workbook.getSheetAt(sheetIndex);
      return new ExcelSheet(sheet.getFirstRowNum() + 1, sheet.getLastRowNum() + 1, sheet::getRow, sheet);
    }
  }
}
