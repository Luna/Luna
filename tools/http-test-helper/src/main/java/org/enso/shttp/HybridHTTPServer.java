package org.enso.shttp;

import com.sun.net.httpserver.*;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyStore;
import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLEngine;
import javax.net.ssl.TrustManagerFactory;

public class HybridHTTPServer {

  private final HttpServer server;
  private final HttpsServer sslServer;
  private final Path keyStorePath;
  private volatile boolean isRunning;

  public HybridHTTPServer(String hostname, int port, int sslPort, Path keyStorePath) throws IOException {
    this.keyStorePath = keyStorePath;
    InetSocketAddress address = new InetSocketAddress(hostname, port);
    server = HttpServer.create(address, 0);
    server.setExecutor(null);

    InetSocketAddress sslAddress = new InetSocketAddress(hostname, sslPort);
    sslServer = HttpsServer.create(sslAddress, 0);
    sslServer.setExecutor(null);
  }

  private static class SimpleHttpsConfigurator extends HttpsConfigurator {
    public SimpleHttpsConfigurator(SSLContext context) {
      super(context);
    }

    @Override
    public void configure(HttpsParameters params) {
      SSLContext ctx = getSSLContext();
      SSLEngine engine = ctx.createSSLEngine();
      params.setNeedClientAuth(false);
      params.setCipherSuites(engine.getEnabledCipherSuites());
      params.setProtocols(engine.getEnabledProtocols());
      params.setSSLParameters(ctx.getDefaultSSLParameters());
    }
  }

  private void setupSSL() throws Exception {
    String password = "test-password";
    SSLContext context = SSLContext.getInstance("TLS");
    KeyStore keyStore = initializeKeyStore(password);

    KeyManagerFactory keyManagerFactory =
        KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm());
    keyManagerFactory.init(keyStore, password.toCharArray());
    TrustManagerFactory trustManagerFactory =
        TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
    trustManagerFactory.init(keyStore);

    context.init(keyManagerFactory.getKeyManagers(), trustManagerFactory.getTrustManagers(), null);
    sslServer.setHttpsConfigurator(new SimpleHttpsConfigurator(context));
  }

  private KeyStore initializeKeyStore(String password) throws Exception {
    KeyStore keyStore = KeyStore.getInstance("JKS");

    if (Files.exists(keyStorePath)) {
      Files.delete(keyStorePath);
    }

    int result = (new ProcessBuilder()).command("keytool", "-genkey", "-alias", "test-key", "-keyalg", "RSA", "-keystore", keyStorePath.toString(), "-storepass", password, "-keypass", password, "-dname", "CN=localhost", "-validity", "365", "-keysize", "2048").inheritIO().start().waitFor();
    if (result != 0) {
      throw new RuntimeException("Failed to generate keystore");
    }
    keyStore.load(Files.newInputStream(keyStorePath), password.toCharArray());

    /*keyStore.load(null, null);

    KeyPairGenerator keyPairGenerator = KeyPairGenerator.getInstance("RSA");
    keyPairGenerator.initialize(2048);
    KeyPair keyPair = keyPairGenerator.generateKeyPair();

    Certificate[] chain = new Certificate[] {

    };
    keyStore.setKeyEntry("test-key", keyPair.getPrivate(), password, chain);

    keyStore.store(Files.newOutputStream(Path.of("test-keystore.jks")), password);*/
    return keyStore;
  }

  public void start() {
    try {
      setupSSL();
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
    server.start();
    sslServer.start();
    isRunning = true;

    System.out.println("HTTP server started at " + server.getAddress());
    System.out.println("HTTPS server started at " + sslServer.getAddress());

    try {
      while (isRunning) {
        Thread.sleep(500);
      }
    } catch (InterruptedException e) {
      e.printStackTrace();
    } finally {
      System.out.println("Finalizing HTTP server...");
      server.stop(1);
      System.out.println("Finalizing HTTPS server...");
      sslServer.stop(1);
      System.out.println("Server stopped.");
    }
  }

  public void stop() {
    isRunning = false;
  }

  public void addHandler(String path, HttpHandler handler) {
    server.createContext(path, handler);
    sslServer.createContext(path, handler);
  }
}
