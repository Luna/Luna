package org.enso.base.enso_cloud;

import org.enso.base.cache.APIRequestCache;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.function.Function;

/**
 * A cache that can be used to save results of cloud requests to avoid re-fetching them every time.
 */
public final class CloudRequestCache extends APIRequestCache {
  public static final CloudRequestCache INSTANCE = new CloudRequestCache();
}
