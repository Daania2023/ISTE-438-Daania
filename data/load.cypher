// ============================================================
// STEP 1: Constraints & Indexes
// ============================================================
CREATE CONSTRAINT book_id IF NOT EXISTS FOR (b:Book) REQUIRE b.bookID IS UNIQUE;
CREATE CONSTRAINT author_name IF NOT EXISTS FOR (a:Author) REQUIRE a.name IS UNIQUE;
CREATE CONSTRAINT publisher_name IF NOT EXISTS FOR (p:Publisher) REQUIRE p.name IS UNIQUE;
CREATE CONSTRAINT language_code IF NOT EXISTS FOR (l:Language) REQUIRE l.code IS UNIQUE;

CREATE INDEX book_rating IF NOT EXISTS FOR (b:Book) ON (b.average_rating);
CREATE INDEX book_title IF NOT EXISTS FOR (b:Book) ON (b.title);

// ============================================================
// STEP 2: Load Books
// ============================================================
LOAD CSV WITH HEADERS FROM 'file:///books_clean.csv' AS row
MERGE (b:Book {bookID: row.bookID})
SET b.title = row.title,
    b.average_rating = toFloat(row.average_rating),
    b.isbn = row.isbn,
    b.num_pages = toInteger(row.num_pages),
    b.ratings_count = toInteger(row.ratings_count),
    b.publication_date = row.publication_date;

// ============================================================
// STEP 3: Load Authors & WROTE relationships
// ============================================================
LOAD CSV WITH HEADERS FROM 'file:///books_clean.csv' AS row
MATCH (b:Book {bookID: row.bookID})
WITH b, split(row.authors, '/') AS authorList
UNWIND authorList AS authorName
WITH b, trim(authorName) AS cleanName
WHERE cleanName <> ''
MERGE (a:Author {name: cleanName})
MERGE (a)-[:WROTE]->(b);

// ============================================================
// STEP 4: Load Publishers & PUBLISHED_BY relationships
// ============================================================
LOAD CSV WITH HEADERS FROM 'file:///books_clean.csv' AS row
MATCH (b:Book {bookID: row.bookID})
WITH b, trim(row.publisher) AS pubName
WHERE pubName <> ''
MERGE (p:Publisher {name: pubName})
MERGE (b)-[:PUBLISHED_BY]->(p);

// ============================================================
// STEP 5: Load Languages & IN_LANGUAGE relationships
// ============================================================
LOAD CSV WITH HEADERS FROM 'file:///books_clean.csv' AS row
MATCH (b:Book {bookID: row.bookID})
WITH b, trim(row.language_code) AS langCode
WHERE langCode <> ''
MERGE (l:Language {code: langCode})
MERGE (b)-[:IN_LANGUAGE]->(l);

// ============================================================
// STEP 6: CO_AUTHORED relationships (authors who share a book)
// ============================================================
MATCH (a1:Author)-[:WROTE]->(b:Book)<-[:WROTE]-(a2:Author)
WHERE a1.name < a2.name
MERGE (a1)-[:CO_AUTHORED]->(a2);

// ============================================================
// VERIFY
// ============================================================
MATCH (x) RETURN count(x) AS NumNodes;
MATCH ()-[r]->() RETURN count(r) AS NumRelationships;
