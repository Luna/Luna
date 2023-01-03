package org.enso.languageserver.websocket.json

import io.circe.literal._
import org.apache.commons.io.FileUtils
import org.eclipse.jgit.api.{Git => JGit}
import org.eclipse.jgit.lib.Repository
import org.eclipse.jgit.revwalk.RevCommit
import org.eclipse.jgit.storage.file.FileRepositoryBuilder
import org.enso.languageserver.boot.ProfilingConfig
import org.enso.languageserver.data._
import org.enso.languageserver.vcsmanager.VcsApi
import org.enso.testkit.RetrySpec

import java.io.File
import java.nio.charset.StandardCharsets
import java.nio.file.{Files, Path, Paths}
import java.time.{Clock, LocalDate}
import scala.concurrent.duration._
import scala.jdk.CollectionConverters._

class VcsManagerTest extends BaseServerTest with RetrySpec {

  override def mkConfig: Config = {
    val directoriesDir = Files.createTempDirectory(null).toRealPath()
    sys.addShutdownHook(FileUtils.deleteQuietly(directoriesDir.toFile))
    Config(
      testContentRoot,
      FileManagerConfig(timeout = 3.seconds),
      VcsManagerConfig(timeout  = 5.seconds),
      PathWatcherConfig(),
      ExecutionContextConfig(requestTimeout = 3.seconds),
      ProjectDirectoriesConfig.initialize(testContentRoot.file),
      ProfilingConfig()
    )
  }

  "Initializing project" must {
    "create a repository" in {
      val client = getInitialisedWsClient()
      client.send(json"""
          { "jsonrpc": "2.0",
            "method": "file/write",
            "id": 1,
            "params": {
              "path": {
                "rootId": $testContentRootId,
                "segments": [ "foo", "bar", "baz.txt" ]
              },
              "contents": "123456789"
            }
          }
          """)
      client.expectJson(json"""
          { "jsonrpc": "2.0",
            "id": 1,
            "result": null
          }
          """)

      client.send(json"""
          { "jsonrpc": "2.0",
            "method": "vcs/init",
            "id": 2,
            "params": {
              "root": {
                "rootId": $testContentRootId,
                "segments": []
              }
            }
          }
          """)
      client.expectJson(json"""
          { "jsonrpc": "2.0",
            "id": 2,
            "result": null
          }
          """)

      val path =
        Paths.get(testContentRoot.file.toString, "foo", "bar", "baz.txt")
      Files.readAllLines(path).get(0) shouldBe "123456789"

      testContentRoot.file.toPath.resolve(".git").toFile shouldNot exist
      testContentRoot.file.toPath
        .resolve(".enso")
        .resolve(".vcs")
        .toFile should exist
    }

    "fail to create a repository for an already existing project" taggedAs Retry in withCleanRoot {
      client =>
        client.send(json"""
          { "jsonrpc": "2.0",
            "method": "vcs/init",
            "id": 1,
            "params": {
              "root": {
                "rootId": $testContentRootId,
                "segments": []
              }
            }
          }
          """)
        client.expectJson(json"""
          { "jsonrpc": "2.0",
            "id": 1,
            "error": {
              "code": 1005,
              "message": "Requested project is already under version control"
            }
          }
          """)
    }
  }

  "Save project" must {
    "create a commit with a timestamp" taggedAs Retry in withCleanRoot {
      client =>
        client.send(json"""
          { "jsonrpc": "2.0",
            "method": "file/write",
            "id": 1,
            "params": {
              "path": {
                "rootId": $testContentRootId,
                "segments": [ "foo", "bar", "baz.txt" ]
              },
              "contents": "123456789"
            }
          }
          """)
        client.expectJson(json"""
          { "jsonrpc": "2.0",
            "id": 1,
            "result": null
          }
          """)

        client.send(json"""
          { "jsonrpc": "2.0",
            "method": "vcs/save",
            "id": 2,
            "params": {
              "root": {
                "rootId": $testContentRootId,
                "segments": []
              }
            }
          }
          """)
        client.fuzzyExpectJson(json"""
          { "jsonrpc": "2.0",
            "id": 2,
            "result": {
              "commitId" : "*",
              "message"  : "*"
            }
          }
          """)
        commits(testContentRoot.file) should have length 2

        client.send(json"""
          { "jsonrpc": "2.0",
            "method": "file/write",
            "id": 3,
            "params": {
              "path": {
                "rootId": $testContentRootId,
                "segments": [ "foo", "bar", "baz.txt" ]
              },
              "contents": "123456789"
            }
          }
          """)
        client.expectJson(json"""
          { "jsonrpc": "2.0",
            "id": 3,
            "result": null
          }
          """)

        client.send(json"""
          { "jsonrpc": "2.0",
            "method": "vcs/save",
            "id": 4,
            "params": {
              "root": {
                "rootId": $testContentRootId,
                "segments": []
              }
            }
          }
          """)
        client.fuzzyExpectJson(json"""
          { "jsonrpc": "2.0",
            "id": 4,
            "result": {
              "commitId" : "*",
              "message"  : "*"
            }
          }
          """)
        val allCommits = commits(testContentRoot.file)
        allCommits should have length 3
        val today = LocalDate.now(Clock.systemUTC())

        allCommits.head.getShortMessage should startWith(today.toString)
    }

    "create a commit with a name" taggedAs Retry in withCleanRoot { client =>
      val saveName1 = "wip: my save"
      client.send(json"""
          { "jsonrpc": "2.0",
            "method": "file/write",
            "id": 1,
            "params": {
              "path": {
                "rootId": $testContentRootId,
                "segments": [ "foo", "bar", "baz.txt" ]
              },
              "contents": "123456789"
            }
          }
          """)
      client.expectJson(json"""
          { "jsonrpc": "2.0",
            "id": 1,
            "result": null
          }
          """)

      client.send(json"""
          { "jsonrpc": "2.0",
            "method": "vcs/save",
            "id": 2,
            "params": {
              "root": {
                "rootId": $testContentRootId,
                "segments": []
              },
              "name": $saveName1
            }
          }
          """)
      client.fuzzyExpectJson(json"""
          { "jsonrpc": "2.0",
            "id": 2,
            "result": {
              "commitId" : "*",
              "message"  : "*"
            }
          }
          """)
      commits(testContentRoot.file) should have length 2

      val saveName2 = "progress"

      client.send(json"""
          { "jsonrpc": "2.0",
            "method": "file/write",
            "id": 3,
            "params": {
              "path": {
                "rootId": $testContentRootId,
                "segments": [ "foo", "bar", "baz.txt" ]
              },
              "contents": "123456789"
            }
          }
          """)
      client.expectJson(json"""
          { "jsonrpc": "2.0",
            "id": 3,
            "result": null
          }
          """)
      client.send(json"""
          { "jsonrpc": "2.0",
            "method": "vcs/save",
            "id": 4,
            "params": {
              "root": {
                "rootId": $testContentRootId,
                "segments": []
              },
              "name": $saveName2
            }
          }
          """)
      client.fuzzyExpectJson(json"""
          { "jsonrpc": "2.0",
            "id": 4,
            "result": {
              "commitId" : "*",
              "message"  : "*"
            }
          }
          """)
      val allCommits = commits(testContentRoot.file)
      allCommits should have length 3
      allCommits(0).getShortMessage should be(saveName2)
      allCommits(1).getShortMessage should be(saveName1)
    }

    "force all pending saves" taggedAs Retry in withCleanRoot { client =>
      this.timingsConfig.withAutoSave(5.seconds)

      val fooPath = testContentRoot.file.toPath.resolve("foo.txt")
      fooPath.toFile.createNewFile()
      Files.write(
        fooPath,
        "123456789".getBytes(StandardCharsets.UTF_8)
      )
      client.send(json"""
          { "jsonrpc": "2.0",
            "method": "text/openFile",
            "id": 1,
            "params": {
              "path": {
                "rootId": $testContentRootId,
                "segments": [ "foo.txt" ]
              }
            }
          }
          """)
      client.expectJson(json"""
          {
            "jsonrpc" : "2.0",
            "id" : 1,
            "result" : {
              "writeCapability" : null,
              "content" : "123456789",
              "currentVersion" : "5795c3d628fd638c9835a4c79a55809f265068c88729a1a3fcdf8522"
            }
          }
          """)
      val saveName1 = "wip: my save"
      client.send(json"""
        { "jsonrpc": "2.0",
          "method": "vcs/save",
          "id": 2,
          "params": {
            "root": {
              "rootId": $testContentRootId,
              "segments": []
            },
            "name": $saveName1
          }
        }
        """)
      client.fuzzyExpectJson(json"""
        { "jsonrpc": "2.0",
          "id": 2,
          "result": {
            "commitId" : "*",
            "message"  : "*"
          }
        }
        """)
      commits(testContentRoot.file) should have length 2
      isClean(testContentRoot.file) should be(true)
    }
  }

  "Status project" must {
    "report changed files since last commit" taggedAs Retry in withCleanRoot {
      client =>
        client.send(json"""
          { "jsonrpc": "2.0",
            "method": "vcs/status",
            "id": 1,
            "params": {
              "root": {
                "rootId": $testContentRootId,
                "segments": []
              }
            }
          }
          """)
        client.fuzzyExpectJson(json"""
          { "jsonrpc": "2.0",
            "id": 1,
            "result": {
              "dirty": false,
              "changed": [],
              "lastSave": {
                "commitId": "*",
                "message": "Initial commit"
              }
            }
          }
          """)

        val srcDir = testContentRoot.file.toPath.resolve("src")
        Files.createDirectory(srcDir)
        val fooPath = srcDir.resolve("Foo.enso")
        fooPath.toFile.createNewFile()
        Files.write(
          fooPath,
          "file contents".getBytes(StandardCharsets.UTF_8)
        )
        val barPath = srcDir.resolve("Bar.enso")
        barPath.toFile.createNewFile()
        Files.write(
          barPath,
          "file contents b".getBytes(StandardCharsets.UTF_8)
        )

        client.send(json"""
          { "jsonrpc": "2.0",
            "method": "vcs/status",
            "id": 2,
            "params": {
              "root": {
                "rootId": $testContentRootId,
                "segments": []
              }
            }
          }
          """)
        client.fuzzyExpectJson(json"""
          { "jsonrpc": "2.0",
            "id": 2,
            "result": {
              "dirty": true,
              "changed": [
                {
                  "rootId" : $testContentRootId,
                  "segments" : [
                    "src",
                    "Bar.enso"
                  ]
                },
                {
                  "rootId" : $testContentRootId,
                  "segments" : [
                    "src",
                    "Foo.enso"
                  ]
                }
              ],
              "lastSave": {
                "commitId": "*",
                "message": "Initial commit"
              }
            }
          }
          """)
        add(testContentRoot.file, srcDir)
        commit(testContentRoot.file, "Add missing files")
        client.send(json"""
          { "jsonrpc": "2.0",
            "method": "vcs/status",
            "id": 3,
            "params": {
              "root": {
                "rootId": $testContentRootId,
                "segments": []
              }
            }
          }
          """)
        client.fuzzyExpectJson(json"""
          { "jsonrpc": "2.0",
            "id": 3,
            "result": {
              "dirty": false,
              "changed": [],
              "lastSave": {
                "commitId": "*",
                "message": "Add missing files"
              }
            }
          }
          """)
    }
  }

  "Restore project" must {
    "reset to the last state with committed changes" taggedAs Retry in withCleanRoot {
      client =>
        client.send(json"""
          { "jsonrpc": "2.0",
            "method": "vcs/status",
            "id": 1,
            "params": {
              "root": {
                "rootId": $testContentRootId,
                "segments": []
              }
            }
          }
          """)
        client.fuzzyExpectJson(json"""
          { "jsonrpc": "2.0",
            "id": 1,
            "result": {
              "dirty": false,
              "changed": [],
              "lastSave": {
                "commitId": "*",
                "message": "Initial commit"
              }
            }
          }
          """)

        val srcDir = testContentRoot.file.toPath.resolve("src")
        Files.createDirectory(srcDir)
        val fooPath = srcDir.resolve("Foo.enso")
        fooPath.toFile.createNewFile()
        Files.write(
          fooPath,
          "file contents".getBytes(StandardCharsets.UTF_8)
        )
        val barPath = srcDir.resolve("Bar.enso")
        barPath.toFile.createNewFile()
        Files.write(
          barPath,
          "file contents b".getBytes(StandardCharsets.UTF_8)
        )
        add(testContentRoot.file, srcDir)
        commit(testContentRoot.file, "Add missing files")
        Files.write(
          fooPath,
          "different contents".getBytes(StandardCharsets.UTF_8)
        )

        client.send(json"""
          { "jsonrpc": "2.0",
            "method": "vcs/status",
            "id": 2,
            "params": {
              "root": {
                "rootId": $testContentRootId,
                "segments": []
              }
            }
          }
          """)
        client.fuzzyExpectJson(json"""
          { "jsonrpc": "2.0",
            "id": 2,
            "result": {
              "dirty": true,
              "changed": [
                {
                  "rootId" : $testContentRootId,
                  "segments" : [
                    "src",
                    "Foo.enso"
                  ]
                }
              ],
              "lastSave": {
                "commitId": "*",
                "message": "Add missing files"
              }
            }
          }
          """)
        client.send(json"""
          { "jsonrpc": "2.0",
            "method": "vcs/restore",
            "id": 3,
            "params": {
              "root": {
                "rootId": $testContentRootId,
                "segments": []
              }
            }
          }
          """)
        client.expectJson(json"""
          { "jsonrpc": "2.0",
            "id": 3,
            "result": {
              "changed": [
                {
                  "rootId": $testContentRootId,
                  "segments": [ "src", "Foo.enso" ]
                }
              ]
            }
          }
          """)

        client.send(json"""
          { "jsonrpc": "2.0",
            "method": "vcs/status",
            "id": 4,
            "params": {
              "root": {
                "rootId": $testContentRootId,
                "segments": []
              }
            }
          }
          """)
        client.fuzzyExpectJson(json"""
          { "jsonrpc": "2.0",
            "id": 4,
            "result": {
              "dirty": false,
              "changed": [],
              "lastSave": {
                "commitId": "*",
                "message": "Add missing files"
              }
            }
          }
          """)

        val text1 = Files.readAllLines(fooPath)
        text1.get(0) should equal("file contents")
    }

    "reset to a named save" taggedAs Retry in withCleanRoot { client =>
      timingsConfig = timingsConfig.withAutoSave(0.5.seconds)
      val sleepDuration: Long = 2 * 1000 // 2 seconds
      val client2             = getInitialisedWsClient()
      val testFileName        = "Foo2.enso"
      client.send(json"""
          { "jsonrpc": "2.0",
            "method": "vcs/status",
            "id": 1,
            "params": {
              "root": {
                "rootId": $testContentRootId,
                "segments": []
              }
            }
          }
          """)
      client.fuzzyExpectJson(json"""
          { "jsonrpc": "2.0",
            "id": 1,
            "result": {
              "dirty": false,
              "changed": [],
              "lastSave": {
                "commitId": "*",
                "message": "Initial commit"
              }
            }
          }
          """)

      val srcDir = testContentRoot.file.toPath.resolve("src")
      Files.createDirectory(srcDir)
      val fooPath = srcDir.resolve(testFileName)
      fooPath.toFile.createNewFile()
      Files.write(
        fooPath,
        "file contents".getBytes(StandardCharsets.UTF_8)
      )
      // "file contents" version: 4d23065da489de360890285072c209b2b39d45d12283dbb5d1fa4389

      add(testContentRoot.file, srcDir)
      commit(testContentRoot.file, "Add missing files")
      val barPath = srcDir.resolve("Bar.enso")
      barPath.toFile.createNewFile()
      Files.write(
        barPath,
        "file contents b".getBytes(StandardCharsets.UTF_8)
      )
      add(testContentRoot.file, srcDir)
      commit(testContentRoot.file, "Release")
      Files.write(
        fooPath,
        "different contents".getBytes(StandardCharsets.UTF_8)
      )
      // "different contents" version: e2bf8493b00a13749e643e2f970b6025c227cc91340c2acb7d67e1da

      add(testContentRoot.file, srcDir)
      commit(testContentRoot.file, "More changes")

      client.send(json"""
          { "jsonrpc": "2.0",
            "method": "text/openFile",
            "id": 2,
            "params": {
              "path": {
                "rootId": $testContentRootId,
                "segments": [ "src", $testFileName ]
              }
            }
          }
      """)

      client.expectJson(json"""
          { "jsonrpc": "2.0",
            "id": 2,
            "result": {
              "writeCapability": null,
              "content": "different contents",
              "currentVersion": "e2bf8493b00a13749e643e2f970b6025c227cc91340c2acb7d67e1da"
            }
          }
          """)
      client2.send(json"""
          { "jsonrpc": "2.0",
            "method": "text/openFile",
            "id": 2,
            "params": {
              "path": {
                "rootId": $testContentRootId,
                "segments": [ "src", $testFileName ]
              }
            }
          }
      """)
      client2.expectJson(json"""
          { "jsonrpc": "2.0",
            "id": 2,
            "result": {
              "writeCapability": null,
              "content": "different contents",
              "currentVersion": "e2bf8493b00a13749e643e2f970b6025c227cc91340c2acb7d67e1da"
            }
          }
          """)

      client.send(json"""
          { "jsonrpc": "2.0",
            "method": "capability/acquire",
            "id": 3,
            "params": {
              "method": "text/canEdit",
              "registerOptions": {
                "path": {
                  "rootId": $testContentRootId,
                  "segments": [ "src", $testFileName ]
                }
              }
            }
          }
          """)

      client.expectJson(json"""
          { "jsonrpc": "2.0",
            "id": 3,
            "result": null
          }
          """)

      client.send(json"""
          { "jsonrpc": "2.0",
            "method": "text/applyEdit",
            "id": 4,
            "params": {
              "edit": {
                "path": {
                  "rootId": $testContentRootId,
                  "segments": [ "src", $testFileName ]
                },
                "oldVersion": "e2bf8493b00a13749e643e2f970b6025c227cc91340c2acb7d67e1da",
                "newVersion": "e4bb87ced8ddafa060f08f2a79cc2861355eb9f596e462d7df462ef4",
                "edits": [
                  {
                    "range": {
                      "start": { "line": 0, "character": 0 },
                      "end": { "line": 0, "character": 9 }
                    },
                    "text": "bar"
                  }
                ]
              }
            }
          }
          """)
      client.expectJson(json"""
          { "jsonrpc": "2.0",
            "id": 4,
            "result": null
          }
          """)
      client2.expectJson(json"""
         { "jsonrpc" : "2.0",
           "method" : "text/didChange",
           "params" : {
             "edits" : [
               {
                 "path" : {
                   "rootId" : $testContentRootId,
                   "segments" : [
                     "src",
                     $testFileName
                   ]
                 },
                 "edits" : [
                   {
                     "range" : {
                       "start" : {
                         "line" : 0,
                         "character" : 0
                       },
                       "end" : {
                         "line" : 0,
                         "character" : 9
                       }
                     },
                     "text" : "bar"
                   }
                 ],
                 "oldVersion" : "e2bf8493b00a13749e643e2f970b6025c227cc91340c2acb7d67e1da",
                 "newVersion" : "e4bb87ced8ddafa060f08f2a79cc2861355eb9f596e462d7df462ef4"
               }
             ]
           }
         }
         """)

      // Ensure auto-save kicks in
      Thread.sleep(sleepDuration)
      client.expectJson(json"""
          { "jsonrpc": "2.0",
            "method":"text/autoSave",
            "params": {
              "path": {
                "rootId": $testContentRootId,
                "segments": [ "src", $testFileName ]
              }
            }
          }
          """)
      client2.expectJson(json"""
          { "jsonrpc": "2.0",
            "method":"text/autoSave",
            "params": {
              "path": {
                "rootId": $testContentRootId,
                "segments": [ "src", $testFileName ]
              }
            }
          }
          """)

      client.send(json"""
          { "jsonrpc": "2.0",
            "method": "vcs/status",
            "id": 5,
            "params": {
              "root": {
                "rootId": $testContentRootId,
                "segments": []
              }
            }
          }
          """)
      client.fuzzyExpectJson(json"""
          { "jsonrpc": "2.0",
            "id": 5,
            "result": {
              "dirty": true,
              "changed": [
                {
                  "rootId" : $testContentRootId,
                  "segments" : [
                    "src",
                    $testFileName
                  ]
                }
              ],
              "lastSave": {
                "commitId": "*",
                "message": "More changes"
              }
            }
          }
          """)
      val allCommits = commits(testContentRoot.file)
      val sndToLast  = allCommits.tail.head

      val text0 = Files.readAllLines(fooPath)
      text0.get(0) should equal("bar contents")

      client.send(json"""
          { "jsonrpc": "2.0",
            "method": "vcs/restore",
            "id": 6,
            "params": {
              "root": {
                "rootId": $testContentRootId,
                "segments": []
              },
              "commitId": ${sndToLast.getName}
            }
          }
          """)
      client.expectJson(json"""
         { "jsonrpc" : "2.0",
           "method" : "text/didChange",
           "params" : {
             "edits" : [
               {
                 "path" : {
                   "rootId" : $testContentRootId,
                   "segments" : [
                     "src",
                     $testFileName
                   ]
                 },
                 "edits" : [
                   {
                     "range" : {
                       "start" : {
                         "line" : 0,
                         "character" : 0
                       },
                       "end" : {
                         "line" : 0,
                         "character" : 13
                       }
                     },
                     "text" : "file contents"
                   }
                 ],
                 "oldVersion" : "e4bb87ced8ddafa060f08f2a79cc2861355eb9f596e462d7df462ef4",
                 "newVersion" : "4d23065da489de360890285072c209b2b39d45d12283dbb5d1fa4389"
               }
             ]
           }
         }""")
      client.expectJson(json"""
          { "jsonrpc": "2.0",
            "id": 6,
            "result": {
              "changed": [
                {
                  "rootId": $testContentRootId,
                  "segments": [ "src", $testFileName ]
                }
              ]
            }
          }
          """)
      client2.expectJson(json"""
         { "jsonrpc" : "2.0",
           "method" : "text/didChange",
           "params" : {
             "edits" : [
               {
                 "path" : {
                   "rootId" : $testContentRootId,
                   "segments" : [
                     "src",
                     $testFileName
                   ]
                 },
                 "edits" : [
                   {
                     "range" : {
                       "start" : {
                         "line" : 0,
                         "character" : 0
                       },
                       "end" : {
                         "line" : 0,
                         "character" : 13
                       }
                     },
                     "text" : "file contents"
                   }
                 ],
                 "oldVersion" : "e4bb87ced8ddafa060f08f2a79cc2861355eb9f596e462d7df462ef4",
                 "newVersion" : "4d23065da489de360890285072c209b2b39d45d12283dbb5d1fa4389"
               }
             ]
           }
         }""")

      val text1 = Files.readAllLines(fooPath)
      text1.get(0) should equal("file contents")

      client.send(json"""
          { "jsonrpc": "2.0",
            "method": "text/applyEdit",
            "id": 7,
            "params": {
              "edit": {
                "path": {
                  "rootId": $testContentRootId,
                  "segments": [ "src", $testFileName ]
                },
                "oldVersion": "4d23065da489de360890285072c209b2b39d45d12283dbb5d1fa4389",
                "newVersion": "1141745721c08c1c1c26ca32b95f103c0721f70eedaa6db765dfc43e",
                "edits": [
                  {
                    "range": {
                      "start": { "line": 0, "character": 0 },
                      "end": { "line": 0, "character": 4 }
                    },
                    "text": "foo"
                  }
                ]
              }
            }
          }
          """)
      client.expectJson(json"""
          { "jsonrpc": "2.0",
            "id": 7,
            "id": 7,
            "result": null
          }
          """)
      client2.expectJson(json"""
         { "jsonrpc" : "2.0",
           "method" : "text/didChange",
           "params" : {
             "edits" : [
               {
                 "path" : {
                   "rootId" : $testContentRootId,
                   "segments" : [
                     "src",
                     $testFileName
                   ]
                 },
                 "edits" : [
                   {
                     "range" : {
                       "start" : {
                         "line" : 0,
                         "character" : 0
                       },
                       "end" : {
                         "line" : 0,
                         "character" : 4
                       }
                     },
                     "text" : "foo"
                   }
                 ],
                 "oldVersion" : "4d23065da489de360890285072c209b2b39d45d12283dbb5d1fa4389",
                 "newVersion" : "1141745721c08c1c1c26ca32b95f103c0721f70eedaa6db765dfc43e"
               }
             ]
           }
         }""")

      // Ensure auto-save kicks in
      Thread.sleep(sleepDuration)
      client.expectJson(json"""
          { "jsonrpc": "2.0",
            "method":"text/autoSave",
            "params": {
              "path": {
                "rootId": $testContentRootId,
                "segments": [ "src", $testFileName ]
              }
            }
          }
          """)
      client2.expectJson(json"""
          { "jsonrpc": "2.0",
            "method":"text/autoSave",
            "params": {
              "path": {
                "rootId": $testContentRootId,
                "segments": [ "src", $testFileName ]
              }
            }
          }
          """)
      val text2 = Files.readAllLines(fooPath)
      text2.get(0) should equal("foo contents")

      client.send(json"""
          { "jsonrpc": "2.0",
            "method": "vcs/restore",
            "id": 8,
            "params": {
              "root": {
                "rootId": $testContentRootId,
                "segments": []
              },
              "commitId": "sth sth"
            }
          }
          """)
      client.expectJson(json"""
          { "jsonrpc": "2.0",
            "id": 8,
            "error": {
              "code": 1004,
              "message": "Requested save not found"
            }
          }
          """)
    }
  }

  "List project saves" must {
    "return all explicit commits" taggedAs Retry in withCleanRoot { client =>
      val srcDir = testContentRoot.file.toPath.resolve("src")
      Files.createDirectory(srcDir)
      val fooPath = srcDir.resolve("Foo.enso")
      fooPath.toFile.createNewFile()
      Files.write(
        fooPath,
        "file contents".getBytes(StandardCharsets.UTF_8)
      )
      add(testContentRoot.file, fooPath)
      commit(testContentRoot.file, "Add missing files")
      val barPath = srcDir.resolve("Bar.enso")
      barPath.toFile.createNewFile()
      Files.write(
        barPath,
        "file contents b".getBytes(StandardCharsets.UTF_8)
      )
      add(testContentRoot.file, barPath)
      commit(testContentRoot.file, "Release")
      Files.write(
        fooPath,
        "different contents".getBytes(StandardCharsets.UTF_8)
      )
      add(testContentRoot.file, fooPath)
      commit(testContentRoot.file, "More changes")

      client.send(json"""
          { "jsonrpc": "2.0",
            "method": "vcs/list",
            "id": 1,
            "params": {
              "root": {
                "rootId": $testContentRootId,
                "segments": []
              }
            }
          }
          """)
      client.fuzzyExpectJson(json"""
          { "jsonrpc": "2.0",
            "id": 1,
            "result": {
              "saves" : [
                {
                  "commitId" : "*",
                  "message" : "More changes"
                },
                {
                  "commitId" : "*",
                  "message" : "Release"
                },
                {
                  "commitId" : "*",
                  "message" : "Add missing files"
                },
                {
                  "commitId" : "*",
                  "message" : "Initial commit"
                }
              ]
            }
          }
          """)

      client.send(json"""
          { "jsonrpc": "2.0",
            "method": "vcs/list",
            "id": 1,
            "params": {
              "root": {
                "rootId": $testContentRootId,
                "segments": []
              },
              "limit": 2
            }
          }
          """)
      client.fuzzyExpectJson(json"""
          { "jsonrpc": "2.0",
            "id": 1,
            "result": {
              "saves" : [
                {
                  "commitId" : "*",
                  "message" : "More changes"
                },
                {
                  "commitId" : "*",
                  "message" : "Release"
                }
              ]
            }
          }
          """)
    }
  }

  def withCleanRoot[T](test: WsTestClient => T): T = {

    FileUtils.deleteQuietly(testContentRoot.file)
    val path = testContentRoot.file
    val vcsRepoPath =
      path.toPath
        .resolve(config.vcsManager.dataDirectory)
        .resolve(VcsApi.DefaultRepoDir)
    val jgit =
      JGit
        .init()
        .setDirectory(path)
        .setGitDir(vcsRepoPath.toFile)
        .setBare(false)
        .call()

    path.toPath.resolve(".git").toFile.delete() shouldBe true

    val client = getInitialisedWsClient()
    jgit
      .add()
      .addFilepattern(
        ensureUnixPathSeparator(
          config.vcsManager.dataDirectory.resolve("suggestions.db")
        )
      )
      .call()
    jgit
      .commit()
      .setAllowEmpty(true)
      .setAll(true)
      .setMessage("Initial commit")
      .setAuthor("Enso VCS", "vcs@enso.io")
      .call()
    test(client)
  }

  private def ensureUnixPathSeparator(path: Path): String =
    ensureUnixPathSeparator(path.toString)

  private def ensureUnixPathSeparator(path: String): String =
    path.replaceAll("\\\\", "/")

  private def repository(path: Path): Repository = {
    val builder = new FileRepositoryBuilder();
    builder
      .setGitDir(
        path
          .resolve(config.vcsManager.dataDirectory)
          .resolve(VcsApi.DefaultRepoDir)
          .toFile
      )
      .setMustExist(true)
      .build()
  }

  def commits(root: File): List[RevCommit] = {
    val jgit = new JGit(repository(root.toPath))
    jgit.log().call().asScala.toList
  }

  def commit(root: File, msg: String): RevCommit = {
    val jgit = new JGit(repository(root.toPath))
    jgit.commit.setMessage(msg).setAuthor("Enso VCS", "vcs@enso.io").call()
  }

  def add(root: File, paths: Path*): Boolean = {
    val jgit = new JGit(repository(root.toPath))
    paths.forall(path =>
      try {
        val relativePath = root.toPath.relativize(path)
        jgit.add().addFilepattern(ensureUnixPathSeparator(relativePath)).call()
        true
      } catch {
        case _: Throwable => false
      }
    )
  }

  def isClean(root: File): Boolean = {
    val jgit   = new JGit(repository(root.toPath))
    val status = jgit.status().call()
    val changed =
      (status.getUntracked().asScala
      ++ status.getModified().asScala
      ++ status.getRemoved().asScala)
    val gitDir = ensureUnixPathSeparator(
      config.vcsManager.dataDirectory.resolve(VcsApi.DefaultRepoDir)
    )
    changed.toList
      .map(ensureUnixPathSeparator)
      .filterNot(file => file.startsWith(gitDir))
      .isEmpty
  }

}
