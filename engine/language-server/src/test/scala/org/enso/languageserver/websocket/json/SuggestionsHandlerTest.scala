package org.enso.languageserver.websocket.json
import java.util.UUID

import io.circe.literal._
import org.enso.languageserver.refactoring.ProjectNameChangedEvent
import org.enso.languageserver.websocket.json.{SearchJsonMessages => json}

class SuggestionsHandlerTest extends BaseServerTest {

  "SuggestionsHandler" must {

    "reply with error when uninitialized" in {
      val client = getInitialisedWsClient()

      client.send(json.getSuggestionsDatabaseVersion(0))
      client.expectJson(json"""
          { "jsonrpc" : "2.0",
            "id" : 0,
            "error" : {
              "code" : 7002,
              "message" : "Project not found in the root directory"
            }
          }
      """)
    }

    "get initial suggestions database version" in {
      system.eventStream.publish(ProjectNameChangedEvent("Test"))
      val client = getInitialisedWsClient()

      client.send(json.getSuggestionsDatabaseVersion(0))
      client.expectJson(json"""
          { "jsonrpc" : "2.0",
            "id" : 0,
            "result" : {
              "currentVersion" : 0
            }
          }
      """)
    }

    "get initial suggestions database" in {
      system.eventStream.publish(ProjectNameChangedEvent("Test"))
      val client = getInitialisedWsClient()

      client.send(json.getSuggestionsDatabase(0))
      client.expectJson(json"""
          { "jsonrpc" : "2.0",
            "id" : 0,
            "result" : {
              "entries" : [
              ],
              "currentVersion" : 0
            }
          }
      """)
    }

    "reply to completion request" in {
      system.eventStream.publish(ProjectNameChangedEvent("Test"))
      val client = getInitialisedWsClient()

      client.send(json"""
        { "jsonrpc": "2.0",
          "method": "search/completion",
          "id": 0,
          "params": {
            "file": {
              "rootId": $testContentRootId,
              "segments": [ "src", "Main.enso" ]
            },
            "position": {
              "line": 0,
              "character": 0
            }
          }
        }
      """)
      client.expectJson(json"""
          { "jsonrpc" : "2.0",
            "id" : 0,
            "result" : {
              "results" : [
              ],
              "currentVersion" : 0
            }
          }
      """)

      client.send(json"""
        { "jsonrpc": "2.0",
          "method": "search/completion",
          "id": 0,
          "params": {
            "file": {
              "rootId": $testContentRootId,
              "segments": [ "src", "Foo", "Main.enso" ]
            },
            "position": {
              "line": 0,
              "character": 0
            }
          }
        }
      """)
      client.expectJson(json"""
          { "jsonrpc" : "2.0",
            "id" : 0,
            "result" : {
              "results" : [
              ],
              "currentVersion" : 0
            }
          }
      """)
    }

    "reply with error when project root not found" in {
      system.eventStream.publish(ProjectNameChangedEvent("Test"))
      val client = getInitialisedWsClient()

      client.send(json"""
        { "jsonrpc": "2.0",
          "method": "search/completion",
          "id": 0,
          "params": {
            "file": {
              "rootId": ${UUID.randomUUID()},
              "segments": [ "src", "Main.enso" ]
            },
            "position": {
              "line": 0,
              "character": 0
            }
          }
        }
      """)
      client.expectJson(json"""
          { "jsonrpc" : "2.0",
            "id" : 0,
            "error" : {
              "code" : 1001,
              "message" : "Content root not found"
            }
          }
      """)
    }
  }

}
