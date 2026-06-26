const express = require('express');
const cors = require('cors');
const neo4j = require('neo4j-driver');

const app = express();
app.use(cors());
app.use(express.json());

// ── Neo4j connection ────────────────────────────────────────
const driver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'password'
  )
);

// ── Health check ────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'ok' }));

// ── Run a Cypher query ──────────────────────────────────────
app.post('/query', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'No query provided' });

  const session = driver.session();
  try {
    const result = await session.run(query);

    const nodes = [];
    const links = [];
    const nodeIds = new Set();

    result.records.forEach(record => {
      record.keys.forEach(key => {
        const val = record.get(key);

        if (val && val.labels) {
          // It's a node
          const id = val.identity.toString();
          if (!nodeIds.has(id)) {
            nodeIds.add(id);
            nodes.push({
              id,
              label: val.labels[0],
              properties: sanitizeProps(val.properties)
            });
          }
        } else if (val && val.type && val.start && val.end) {
          // It's a relationship
          links.push({
            source: val.start.toString(),
            target: val.end.toString(),
            type: val.type,
            properties: sanitizeProps(val.properties)
          });
        }
      });
    });

    res.json({ nodes, links });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    await session.close();
  }
});

// ── Preset queries list ─────────────────────────────────────
app.get('/presets', (req, res) => {
  res.json([
    {
      label: '📚 Top 10 Highest Rated Books',
      query: `MATCH (a:Author)-[:WROTE]->(b:Book)
WHERE b.ratings_count > 1000
RETURN a, b
ORDER BY b.average_rating DESC
LIMIT 10`
    },
    {
      label: '✍️ Most Prolific Authors (Top 10)',
      query: `MATCH (a:Author)-[:WROTE]->(b:Book)
WITH a, count(b) AS numBooks
WHERE numBooks > 3
MATCH (a)-[:WROTE]->(b:Book)
RETURN a, b
ORDER BY numBooks DESC
LIMIT 30`
    },
    {
      label: '🏢 Top Publisher Network',
      query: `MATCH (b:Book)-[:PUBLISHED_BY]->(p:Publisher)
WITH p, count(b) AS numBooks
ORDER BY numBooks DESC
LIMIT 5
MATCH (b:Book)-[:PUBLISHED_BY]->(p)
MATCH (a:Author)-[:WROTE]->(b)
RETURN a, b, p
LIMIT 40`
    },
    {
      label: '🤝 Co-Author Collaborations',
      query: `MATCH (a1:Author)-[:CO_AUTHORED]->(a2:Author)
WITH a1, a2
LIMIT 20
MATCH (a1)-[:WROTE]->(b:Book)<-[:WROTE]-(a2)
RETURN a1, a2, b`
    },
    {
      label: '🌍 Books by Language',
      query: `MATCH (b:Book)-[:IN_LANGUAGE]->(l:Language)
WITH l, count(b) AS numBooks
ORDER BY numBooks DESC
LIMIT 5
MATCH (b:Book)-[:IN_LANGUAGE]->(l)
RETURN b, l
LIMIT 50`
    },
    {
      label: '📖 Long Books Network (500+ pages)',
      query: `MATCH (a:Author)-[:WROTE]->(b:Book)-[:PUBLISHED_BY]->(p:Publisher)
WHERE b.num_pages > 500
RETURN a, b, p
LIMIT 40`
    }
  ]);
});

// ── Helpers ─────────────────────────────────────────────────
function sanitizeProps(props) {
  const out = {};
  for (const [k, v] of Object.entries(props)) {
    if (neo4j.isInt(v)) out[k] = v.toNumber();
    else out[k] = v;
  }
  return out;
}

// ── Start ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
