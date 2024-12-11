package org.enso.table.excel.xssfreader;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.SortedMap;
import java.util.TreeMap;
import javax.xml.parsers.ParserConfigurationException;
import org.apache.poi.openxml4j.exceptions.InvalidFormatException;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.util.XMLHelper;
import org.enso.table.excel.ExcelRow;
import org.enso.table.excel.ExcelSheet;
import org.xml.sax.InputSource;
import org.xml.sax.SAXException;

public class XSSFReaderSheet implements ExcelSheet {
  private final int sheetIdx;
  private final String sheetName;
  private final String relId;
  private final XSSFReaderWorkbook parent;

  private boolean readSheetData = false;
  private String dimensions;
  private int firstRow;
  private int lastRow;
  private Map<Integer, SortedMap<Short, XSSFReaderSheetXMLHandler.CellValue>> rowData;

  public XSSFReaderSheet(int sheetIdx, String sheetName, String relId, XSSFReaderWorkbook parent) {
    this.sheetIdx = sheetIdx;
    this.sheetName = sheetName;
    this.relId = relId;
    this.parent = parent;
  }

  private synchronized void readSheetData() {
    if (readSheetData) {
      return;
    }

    try {
      var strings = parent.getSharedStrings();
      var styles = parent.getStyles();
      var handler =
          new XSSFReaderSheetXMLHandler(styles, strings) {
            @Override
            protected void onDimensions(String dimension) {
              handleOnDimensions(dimension);
            }

            @Override
            protected void onStartRow(int rowNum) {
              handleOnStartRow(rowNum);
            }

            @Override
            protected void onCell(int rowNumber, short columnNumber, String ref, CellValue value) {
              handleOnCell(rowNumber, columnNumber, value);
            }
          };

      var xmlReader = XMLHelper.newXMLReader();
      xmlReader.setContentHandler(handler);

      rowData = new HashMap<>();

      try {
        parent.withReader(
            reader -> {
              try {
                var sheet = reader.getSheet(relId);
                xmlReader.parse(new InputSource(sheet));
              } catch (SAXException | InvalidFormatException | IOException e) {
                throw new RuntimeException(e);
              }
            });
      } catch (IOException e) {
        throw new RuntimeException(e);
      }

      readSheetData = true;
    } catch (SAXException | ParserConfigurationException e) {
      throw new RuntimeException(e);
    }
  }

  @Override
  public int getSheetIndex() {
    return sheetIdx;
  }

  @Override
  public String getName() {
    return sheetName;
  }

  public String getDimensions() {
    if (!readSheetData) {
      readSheetData();
    }
    return dimensions;
  }

  @Override
  public int getFirstRow() {
    if (!readSheetData) {
      readSheetData();
    }
    return firstRow;
  }

  @Override
  public int getLastRow() {
    if (!readSheetData) {
      readSheetData();
    }
    return lastRow;
  }

  @Override
  public ExcelRow get(int row) {
    if (!readSheetData) {
      readSheetData();
    }

    if (!rowData.containsKey(row)) {
      return null;
    }

    return new XSSFReaderRow(rowData.get(row), parent.use1904Format());
  }

  @Override
  public Sheet getSheet() {
    // Not supported as we don't have the underlying Apache POI Sheet object.
    return null;
  }

  protected void handleOnDimensions(String dimension) {
    dimensions = dimension;
  }

  private void handleOnStartRow(int rowNum) {
    if (firstRow == 0 || rowNum < firstRow) {
      firstRow = rowNum;
    }

    if (lastRow == 0 || rowNum > lastRow) {
      lastRow = rowNum;
    }
  }

  private void handleOnCell(
      int rowNumber, short columnNumber, XSSFReaderSheetXMLHandler.CellValue value) {
    if (rowData.containsKey(rowNumber)) {
      rowData.get(rowNumber).put(columnNumber, value);
    } else {
      var map = new TreeMap<Short, XSSFReaderSheetXMLHandler.CellValue>();
      map.put(columnNumber, value);
      rowData.put(rowNumber, map);
    }
  }
}
