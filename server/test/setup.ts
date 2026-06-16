// Force la base de test AVANT tout import (dotenv ne surcharge pas les vars déjà définies).
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || "postgresql://barreau:barreau_dev@localhost:5432/barreau_pn_test?schema=public";
process.env.JWT_SECRET = "test-secret";
process.env.SIGNATURE_SECRET = "test-signature";
process.env.NODE_ENV = "test";
