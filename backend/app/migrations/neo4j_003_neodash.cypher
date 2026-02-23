// NeoDash 대시보드 seed
// NeoDash는 _Neodash_Dashboard 레이블 노드에 JSON 문자열로 대시보드를 저장합니다.
MERGE (d:_Neodash_Dashboard {uuid: "neo4j-dev-overview"})
SET d.title = "Neo4j Dev Stack Overview",
    d.version = "2.4",
    d.user = "neo4j",
    d.date = datetime(),
    d.content = '{
  "title": "Neo4j Dev Stack Overview",
  "version": "2.4",
  "settings": {
    "pagenumber": 0,
    "editable": true,
    "fullscreenEnabled": false,
    "parameters": {},
    "theme": "default"
  },
  "pages": [
    {
      "title": "Overview",
      "reports": [
        {
          "id": "1",
          "title": "Total Entities",
          "query": "MATCH (e:Entity) RETURN count(e) AS Total",
          "width": 3,
          "height": 2,
          "x": 0,
          "y": 0,
          "type": "value",
          "selection": {},
          "settings": {
            "fontSize": 64,
            "color": "rgba(0,168,255,1)"
          }
        },
        {
          "id": "2",
          "title": "Entities by Type",
          "query": "MATCH (e:Entity) RETURN e.entityType AS Type, count(e) AS Count ORDER BY Count DESC",
          "width": 9,
          "height": 2,
          "x": 3,
          "y": 0,
          "type": "bar",
          "selection": {
            "index": "Type",
            "value": "Count",
            "key": "Type"
          },
          "settings": {
            "legend": true
          }
        },
        {
          "id": "3",
          "title": "Entity Relationship Graph",
          "query": "MATCH path=(a:Entity)-[r]->(b:Entity) RETURN path LIMIT 50",
          "width": 12,
          "height": 6,
          "x": 0,
          "y": 2,
          "type": "graph",
          "selection": {
            "Entity": "name"
          },
          "settings": {
            "nodePositions": {},
            "defaultNodeSize": "large",
            "nodeSizeProp": "size",
            "nodeColorProp": "entityType",
            "showPropertiesOnHover": true,
            "showPropertiesOnClick": true,
            "layout": "force-directed"
          }
        },
        {
          "id": "4",
          "title": "Recent Entities",
          "query": "MATCH (e:Entity) RETURN e.id AS ID, e.entityType AS Type, e.name AS Name, e.status AS Status, toString(e.updatedAt) AS UpdatedAt ORDER BY e.updatedAt DESC LIMIT 20",
          "width": 12,
          "height": 4,
          "x": 0,
          "y": 8,
          "type": "table",
          "selection": {},
          "settings": {
            "compact": true,
            "columnWidths": "[1,1,2,1,2]"
          }
        }
      ]
    },
    {
      "title": "Relationships",
      "reports": [
        {
          "id": "5",
          "title": "Relationship Types",
          "query": "MATCH ()-[r]->() RETURN type(r) AS RelType, count(r) AS Count ORDER BY Count DESC",
          "width": 6,
          "height": 3,
          "x": 0,
          "y": 0,
          "type": "bar",
          "selection": {
            "index": "RelType",
            "value": "Count",
            "key": "RelType"
          },
          "settings": {
            "legend": false
          }
        },
        {
          "id": "6",
          "title": "Online / Active Entities",
          "query": "MATCH (e:Entity) WHERE e.status IN [\"ONLINE\", \"RUNNING\", \"ACTIVE\"] RETURN e.entityType AS Type, count(e) AS Count ORDER BY Count DESC",
          "width": 6,
          "height": 3,
          "x": 6,
          "y": 0,
          "type": "pie",
          "selection": {
            "index": "Type",
            "value": "Count",
            "key": "Type"
          },
          "settings": {}
        },
        {
          "id": "7",
          "title": "Full Graph (LIMIT 100)",
          "query": "MATCH path=(a:Entity)-[r]->(b:Entity) RETURN path LIMIT 100",
          "width": 12,
          "height": 7,
          "x": 0,
          "y": 3,
          "type": "graph",
          "selection": {
            "Entity": "name"
          },
          "settings": {
            "showPropertiesOnHover": true,
            "showPropertiesOnClick": true,
            "nodeColorProp": "entityType",
            "layout": "force-directed"
          }
        }
      ]
    }
  ]
}';
