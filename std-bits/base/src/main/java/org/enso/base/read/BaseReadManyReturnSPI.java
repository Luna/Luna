package org.enso.base.read;

public final class BaseReadManyReturnSPI extends ReadManyReturnSPI {
  @Override
  protected String getModuleName() {
    return "Standard.Base.Data.Read.Return_As";
  }

  @Override
  protected String getTypeName() {
    return "Return_As_Base";
  }
}
