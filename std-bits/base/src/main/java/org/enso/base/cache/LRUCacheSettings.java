package org.enso.base.cache;

import org.enso.base.Environment_Utils;

public class LRUCacheSettings {
  /**
   * Default value for the largest file size allowed.
   * Should be overridden with the ENSO_LIB_HTTP_CACHE_MAX_FILE_SIZE_MEGS environment variable.
   */
  private static final long DEFAULT_MAX_FILE_SIZE = 2L * 1024 * 1024 * 1024;

  /**
   * Default value for the percentage of free disk space to use as a limit on the total cache size.
   * Should be overridden with the ENSO_LIB_HTTP_CACHE_MAX_TOTAL_CACHE_LIMIT environment variable.
   */
  private static final double DEFAULT_TOTAL_CACHE_SIZE_FREE_SPACE_PERCENTAGE = 0.2;

  /**
   * Maximum size allowed for a single file. If a file larger than this is
   * requested through this cache, a ResponseTooLargeException is thrown.
   */
  private final long maxFileSize;

  /**
   * Limits the total size of all files in the cache.
   *
   * This value can depend on free disk space, so it is not resolved to a
   * maximum byte count at initialization time, but recalculated during each
   * file cleanup.
   */
  private final TotalCacheLimit.Limit totalCacheLimit;

  public LRUCacheSettings(long maxFileSize, TotalCacheLimit.Limit totalCacheLimit) {
    this.maxFileSize = maxFileSize;
    this.totalCacheLimit = totalCacheLimit;
  }

  public LRUCacheSettings(String maxFileSizeSpec, String totalCacheLimitSpec) {
    this(parseMaxFileSize(maxFileSizeSpec), parseTotalCacheLimit(totalCacheLimitSpec));
  }

  /** Uses defaults if the vars are not set. */
  public static LRUCacheSettings getDefault() {
    String maxFileSizeSpec = Environment_Utils.get_environment_variable("ENSO_LIB_HTTP_CACHE_MAX_FILE_SIZE_MEGS");
    String totalCacheLimitSpec = Environment_Utils.get_environment_variable("ENSO_LIB_HTTP_CACHE_MAX_TOTAL_CACHE_LIMIT");
    if (maxFileSizeSpec != null && totalCacheLimitSpec != null) {
      return new LRUCacheSettings(maxFileSizeSpec, totalCacheLimitSpec);
    } else {
      return new LRUCacheSettings(DEFAULT_MAX_FILE_SIZE, DEFAULT_TOTAL_CACHE_SIZE_FREE_SPACE_PERCENTAGE);
    }
  }

  public long getMaxFileSize() {
    return maxFileSize;
  }

  public TotalCacheSize.Limit getTotalCacheLimit() {
    return totalCacheLimit;
  }

  /** Uses the environment variable if set, otherwise uses a default. */
  private static long parseMaxFileSize(String maxFileSizeSpec) {
    double maxFileSizeMegs = Double.parseDouble(maxFileSizeSpec);
    return (long) (maxFileSizeMegs * 1024 * 1024);
  }

  /** Uses the environment variable if set, otherwise uses a default percentage. */
  private static TotalCacheLimit.Limit parseTotalCacheLimit() {
    return TotalCacheLimit.parse(totalCacheLimitSpec );
  }
}