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

public class GoogleAnalyticsReader {
  public record AnalyticsAccount(String id, String displayName, boolean deleted, ZonedDateTime created, String regionCode) {}

  private static AnalyticsAdminServiceClient createAdminClient(CredentialsProvider credentialsProvider) throws IOException {
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

  /** Lists all properties of a given account. */
  public static void listProperties(CredentialsProvider credentialsProvider, AnalyticsAccount parent, int limit, boolean includeDeleted) throws IOException {
    int pageSize = getPageSize(limit);
    try (var client = createAdminClient(credentialsProvider)) {
      var request = ListPropertiesRequest
          .newBuilder()
          .setPageSize(pageSize)
          .setShowDeleted(includeDeleted)
          .build();

      var response = client.listProperties(request);
      for (var page : response.iteratePages()) {
        for (var property : page.iterateAll()) {
        }
      }
    }
  }
}
