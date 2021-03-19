package org.enso.image.data;

import org.enso.image.opencv.OpenCV;
import org.opencv.core.*;
import org.opencv.imgcodecs.Imgcodecs;

import java.util.Base64;

/** Methods for standard library operations on Image. */
public class Image {

  static {
    OpenCV.loadShared();
    System.loadLibrary(Core.NATIVE_LIBRARY_NAME);
  }

  private static final byte MAX_SIGNED_BYTE = -1;
  private static final double MAX_UNSIGNED_BYTE = 255;

  private static final String EXTENSION_PNG = ".png";

  /**
   * Create the image from vector of normalized values in range [0.0 .. 1.0].
   *
   * @param values array of normalized values.
   * @param rows the number of rows.
   * @param channels the number of channels.
   * @return the new matrix.
   */
  public static Mat from_vector(double[] values, int rows, int channels) {
    byte[] bytes = new byte[values.length];
    for (int i = 0; i < values.length; i++) {
      bytes[i] = denormalize(values[i]);
    }
    return new MatOfByte(bytes).reshape(channels, rows);
  }
  /**
   * Get the pixels of an image as a byte array.
   *
   * @param mat the matrix.
   * @return the array of image pixels.
   */
  public static Object to_vector(Mat mat) {
    byte[] data = new byte[(int) mat.total() * mat.channels()];
    mat.get(0, 0, data);
    return Image.normalize(data);
  }

  /**
   * Encode the image as a base64 string.
   *
   * @param mat the image to encode.
   * @return the base64 string representing the image data.
   */
  public static String to_base64(Mat mat) {
    MatOfByte buf = new MatOfByte();
    Imgcodecs.imencode(EXTENSION_PNG, mat, buf);
    byte[] bufData = new byte[(int) buf.total() * buf.channels()];
    buf.get(0, 0, bufData);
    return Base64.getEncoder().encodeToString(bufData);
  }

  /**
   * Compare two images for equality.
   *
   * @param mat1 the first image to compare.
   * @param mat2 the second images to compare.
   * @return {@code true} when two images contain the same pixels and {@code false} otherwise.
   */
  public static boolean is_equals(Mat mat1, Mat mat2) {
    if (mat1.size().equals(mat2.size()) && mat1.type() == mat2.type()) {
      Mat dst = Mat.zeros(mat1.size(), mat1.type());
      Core.subtract(mat1, mat2, dst);
      return Core.sumElems(dst).equals(Scalar.all(0));
    }
    return false;
  }

  /**
   * Get the image pixel by the row and the column.
   *
   * @param mat the image.
   * @param row the row index.
   * @param column the column index.
   * @return the value located at the given row and the column of the image.
   */
  public static Object get(Mat mat, int row, int column) {
    byte[] data = new byte[mat.channels()];
    int[] idx = new int[] {row, column};

    mat.get(idx, data);
    return Image.normalize(data);
  }

  /**
   * Add the scalar to each elemet of the image.
   *
   * @param mat the image.
   * @param scalar the scalar to add.
   * @param dst the matrix holding the result of the operation.
   */
  public static void add(Mat mat, Scalar scalar, Mat dst) {
    Core.add(mat, denormalize(scalar), dst);
  }

  /**
   * Subtract the scalar from each element of the image.
   *
   * @param mat the matrix.
   * @param scalar the scalar to subtract.
   * @param dst the matrix holding the result of the operation.
   */
  public static void subtract(Mat mat, Scalar scalar, Mat dst) {
    Core.subtract(mat, denormalize(scalar), dst);
  }

  /**
   * Multiply the scalar with each element of the image.
   *
   * @param mat the image.
   * @param scalar the scalar to multiply with.
   * @param dst the matrix holding the result of the operation.
   */
  public static void multiply(Mat mat, Scalar scalar, Mat dst) {
    Core.multiply(mat, scalar, dst);
  }

  /**
   * Divite each element of the matrix by the scalar.
   *
   * @param mat the matrix
   * @param scalar the scalar to divide on.
   * @param dst the matrix holding the result of the operation.
   */
  public static void divide(Mat mat, Scalar scalar, Mat dst) {
    Core.divide(mat, scalar, dst);
  }

  /**
   * Normalize the byte array.
   *
   * @param bytes the byte array to normalize.
   * @return return normalized values in the range of 0.0 to 1.0.
   */
  private static double[] normalize(byte[] bytes) {
    double[] buf = new double[bytes.length];
    for (int i = 0; i < bytes.length; i++) {
      buf[i] = Image.normalize(bytes[i]);
    }
    return buf;
  }

  /**
   * Normalize the byte value.
   *
   * @param value the value to normalize.
   * @return return the normalized value in the range of [0.0 .. 1.0].
   */
  private static double normalize(byte value) {
    return (value & 0xff) / MAX_UNSIGNED_BYTE;
  }

  /**
   * Denormalize the value into the byte range.
   *
   * @param scalar the normalized scalar.
   * @return the scalar scaled from normalized range [0.0 .. 1.0] to a byte range.
   */
  private static Scalar denormalize(Scalar scalar) {
    return scalar.mul(Scalar.all(MAX_UNSIGNED_BYTE));
  }

  /**
   * Denormalize the value into a byte range.
   *
   * <p>The following holds: {@code denormalize(normalize(value)) == value}.
   *
   * @param value the normalized value
   * @return the value scaled from normalized range [0.0 .. 1.0] to a byte range.
   */
  private static byte denormalize(double value) {
    return (byte) (value * MAX_UNSIGNED_BYTE);
  }
}
