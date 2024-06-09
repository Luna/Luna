package org.enso.database.postgres;

import org.enso.database.DatabaseConnectionDetailsSPI;

@org.openide.util.lookup.ServiceProvider(service = DatabaseConnectionDetailsSPI.class)
public class PostgresConnectionDetailsSPI extends DatabaseConnectionDetailsSPI {
  @Override
  protected String getModuleName() {
    return "Standard.Database.Connection.Postgres_Details";
  }

  @Override
  protected String getTypeName() {
    return "Postgres_Details";
  }

  @Override
  protected String getCodeForDefaultConstructor() {
    return "(Postgres 'localhost' 5432)";
  }

  @Override
  protected String getUserFacingConnectionName() {
    return "Postgres";
  }
}
