package org.enso.database.postgres;

import org.enso.database.DatabaseConnectionDetailsSPI;

@org.openide.util.lookup.ServiceProvider(service = DatabaseConnectionDetailsSPI.class)
public class PostgresConnectionDetailsSPI extends DatabaseConnectionDetailsSPI {
  @Override
  protected String getModuleName() {
    return "Standard.Database.Connection.Postgres";
  }

  @Override
  protected String getTypeName() {
    return "Postgres";
  }

  @Override
  protected String getCodeForDefaultConstructor() {
    return "(Postgres.Server 'localhost' 5432)";
  }

  @Override
  protected String getUserFacingConnectionName() {
    return "Postgres";
  }
}
