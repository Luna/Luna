package org.enso.google;

import com.google.analytics.admin.v1beta.AnalyticsAdminServiceClient;
import com.google.analytics.admin.v1beta.AnalyticsAdminServiceSettings;
import com.google.analytics.admin.v1beta.ListAccountsRequest;
import com.google.analytics.admin.v1beta.ListPropertiesRequest;
import com.google.api.gax.core.CredentialsProvider;

import java.io.IOException;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.TimeZone;

public class GoogleAnalyticsReader {
  /** Represents a Google Analytics account. */
  public record AnalyticsAccount(String id, String displayName, boolean deleted, ZonedDateTime created, String regionCode) {}

  public record AnalyticsProperty(String id, String displayName, boolean deleted, ZonedDateTime created, String account, String currency, TimeZone timeZone) {}

  private static AnalyticsAdminServiceClient createAdminClient(CredentialsProvider credentialsProvider) throws IOException {
    if (credentialsProvider == null) {
      // Default Credentials Path
      return AnalyticsAdminServiceClient.create();
    }

    var settings = AnalyticsAdminServiceSettings.newBuilder()
        .setCredentialsProvider(credentialsProvider)
        .build();
    return AnalyticsAdminServiceClient.create(settings);
  }

  /** Lists all Google Analytics accounts. */
  public static AnalyticsAccount[] listAccounts(CredentialsProvider credentialsProvider, int limit, boolean includeDeleted) throws IOException {
    int pageSize = getPageSize(limit);
    try (var client = createAdminClient(credentialsProvider)) {
      var request = ListAccountsRequest
          .newBuilder()
          .setPageSize(pageSize)
          .setShowDeleted(includeDeleted)
          .build();

      var response = client.listAccounts(request);
      var output = new ArrayList<AnalyticsAccount>(pageSize);
      for (var page : response.iteratePages()) {
        for (var account : page.iterateAll()) {
          var ensoAccount = new AnalyticsAccount(
              account.getName(),
              account.getDisplayName(),
              account.getDeleted(),
              Instant.ofEpochSecond(account.getCreateTime().getSeconds(), account.getCreateTime().getNanos()).atZone(ZoneId.systemDefault()),
              account.getRegionCode()
          );

          output.add(ensoAccount);
          if (limit != 0 && output.size() == limit) {
            break;
          }
        }
      }

      return output.toArray(new AnalyticsAccount[0]);
    }
  }

  private static int getPageSize(int limit) {
    return (limit == 0 || limit > 1000) ? 1000 : limit;
  }

  /**
   * Lists all properties of a given account.
   *
   * @param credentialsProvider the credentials provider
   * @param parents the parent accounts or null for all properties
   *               (e.g. "accounts/123" for account with ID 123)
   * @param limit the maximum number of properties to return
   *              (0 for all properties, up to 1000)
   * @param includeDeleted whether to include deleted properties
   * @return an array of properties
   */
  public static AnalyticsProperty[] listProperties(CredentialsProvider credentialsProvider, AnalyticsAccount[] parents, int limit, boolean includeDeleted) throws IOException {
    if (parents == null) {
      parents = listAccounts(credentialsProvider, 0, false);
    }

    if (parents.length == 0) {
      return new AnalyticsProperty[0];
    }

    int pageSize = getPageSize(limit);
    var output = new ArrayList<AnalyticsProperty>(pageSize);
    try (var client = createAdminClient(credentialsProvider)) {
      for (var parent : parents) {
        var request = ListPropertiesRequest
            .newBuilder()
            .setPageSize(pageSize)
            .setShowDeleted(includeDeleted)
            .setFilter("parent: " + parent.id());

        var response = client.listProperties(request.build());
        for (var page : response.iteratePages()) {
          for (var property : page.iterateAll()) {
            var ensoProperty = new AnalyticsProperty(
                property.getName(),
                property.getDisplayName(),
                property.hasDeleteTime(),
                Instant.ofEpochSecond(property.getCreateTime().getSeconds(), property.getCreateTime().getNanos()).atZone(ZoneId.systemDefault()),
                property.getAccount(),
                property.getCurrencyCode(),
                TimeZone.getTimeZone(property.getTimeZone())
            );
            output.add(ensoProperty);
          }
        }
      }

      return output.toArray(new AnalyticsProperty[0]);
    }
  }
}
