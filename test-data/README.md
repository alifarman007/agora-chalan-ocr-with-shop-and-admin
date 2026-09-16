# Test data

Real chalans and receipts are client documents. **They are never committed.**

Put them in `test-data/private/`, which git ignores. Only this README and a manifest of
file hashes may be committed, so we can tell which sample is missing without ever
storing the document itself.

    test-data/
      README.md          committed
      manifest.json      committed — sha256 + mime type + a one-line description
      private/           GIT-IGNORED — the actual files
