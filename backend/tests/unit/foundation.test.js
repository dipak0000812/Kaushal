import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import { app } from '../../src/app.js';
import { env } from '../../src/config/env.js';
import { API_PREFIX } from '../../src/core/constants.js';
import {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  BusinessRuleError,
} from '../../src/core/errors.js';
import { errorHandler } from '../../src/middlewares/error-handler.js';

describe('Kaushal Runtime Foundation', () => {
  describe('Configuration (env.js)', () => {
    it('loads and freezes environment configuration', () => {
      assert.ok(env);
      assert.equal(typeof env.PORT, 'number');
      assert.ok(env.MONGODB_URI);
      assert.ok(env.JWT_SECRET);
      assert.ok(Object.isFrozen(env));
    });
  });

  describe('Constants (constants.js)', () => {
    it('exports the standard API version prefix', () => {
      assert.equal(API_PREFIX, '/api/v1');
    });
  });

  describe('Error hierarchy (errors.js)', () => {
    it('creates AppError with status code and code', () => {
      const err = new AppError('test error', 418, 'I_AM_A_TEAPOT');
      assert.equal(err.message, 'test error');
      assert.equal(err.statusCode, 418);
      assert.equal(err.code, 'I_AM_A_TEAPOT');
      assert.ok(err instanceof Error);
    });

    it('creates ValidationError with 400', () => {
      const err = new ValidationError('Bad input', [{ path: 'name', message: 'Required' }]);
      assert.equal(err.statusCode, 400);
      assert.equal(err.code, 'VALIDATION_ERROR');
      assert.deepEqual(err.details, [{ path: 'name', message: 'Required' }]);
    });

    it('creates UnauthorizedError with 401', () => {
      const err = new UnauthorizedError();
      assert.equal(err.statusCode, 401);
      assert.equal(err.code, 'UNAUTHORIZED');
    });

    it('creates ForbiddenError with 403', () => {
      const err = new ForbiddenError();
      assert.equal(err.statusCode, 403);
      assert.equal(err.code, 'FORBIDDEN');
    });

    it('creates NotFoundError with 404', () => {
      const err = new NotFoundError('User not found');
      assert.equal(err.statusCode, 404);
      assert.equal(err.code, 'NOT_FOUND');
    });

    it('creates ConflictError with 409', () => {
      const err = new ConflictError('Already exists', 'DUPLICATE_ENTRY');
      assert.equal(err.statusCode, 409);
      assert.equal(err.code, 'DUPLICATE_ENTRY');
    });

    it('creates BusinessRuleError with 422', () => {
      const err = new BusinessRuleError('Cannot proceed', 'RULE_VIOLATION');
      assert.equal(err.statusCode, 422);
      assert.equal(err.code, 'RULE_VIOLATION');
    });
  });

  describe('Centralized error-handler middleware', () => {
    it('formats Zod validation errors to 400 with details', async () => {
      const testApp = express();
      testApp.use(express.json());
      testApp.get('/test-zod', (_req, _res, next) => {
        const schema = z.object({ id: z.string().uuid() });
        const result = schema.safeParse({ id: 'bad' });
        if (!result.success) return next(result.error);
      });
      testApp.use(errorHandler);

      const server = testApp.listen(0);
      const port = server.address().port;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/test-zod`);
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.success, false);
        assert.equal(data.error.code, 'VALIDATION_ERROR');
        assert.ok(Array.isArray(data.error.details));
        assert.equal(data.error.details[0].path, 'id');
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    });

    it('formats MongoServerError code 11000 to 409 CONFLICT', async () => {
      const testApp = express();
      testApp.get('/test-duplicate', (_req, _res, next) => {
        const err = new Error('E11000 duplicate key error');
        err.name = 'MongoServerError';
        err.code = 11000;
        next(err);
      });
      testApp.use(errorHandler);

      const server = testApp.listen(0);
      const port = server.address().port;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/test-duplicate`);
        assert.equal(res.status, 409);
        const data = await res.json();
        assert.equal(data.success, false);
        assert.equal(data.error.code, 'CONFLICT');
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    });

    it('formats Mongoose CastError to 400 INVALID_ID', async () => {
      const testApp = express();
      testApp.get('/test-cast', (_req, _res, next) => {
        const err = new mongoose.Error.CastError('ObjectId', 'invalid-id', 'studentId');
        next(err);
      });
      testApp.use(errorHandler);

      const server = testApp.listen(0);
      const port = server.address().port;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/test-cast`);
        assert.equal(res.status, 400);
        const data = await res.json();
        assert.equal(data.success, false);
        assert.equal(data.error.code, 'INVALID_ID');
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    });

    it('formats unknown errors to 500 INTERNAL_SERVER_ERROR', async () => {
      const testApp = express();
      testApp.get('/test-unknown', (_req, _res, next) => {
        next(new Error('something crashed unexpectedly'));
      });
      testApp.use(errorHandler);

      const server = testApp.listen(0);
      const port = server.address().port;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/test-unknown`);
        assert.equal(res.status, 500);
        const data = await res.json();
        assert.equal(data.success, false);
        assert.equal(data.error.code, 'INTERNAL_SERVER_ERROR');
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    });
  });

  describe('Express app routes & error handling', () => {
    it('serves GET /health with 200 and success shape without DB connection', async () => {
      const server = app.listen(0);
      const port = server.address().port;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/health`);
        assert.equal(res.status, 200);
        const data = await res.json();
        assert.deepEqual(data, { success: true, status: 'ok' });
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    });

    it('handles 404 with standardized error response shape', async () => {
      const server = app.listen(0);
      const port = server.address().port;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/unknown-route`);
        assert.equal(res.status, 404);
        const data = await res.json();
        assert.equal(data.success, false);
        assert.equal(data.error.code, 'NOT_FOUND');
        assert.ok(data.error.message.includes('GET /unknown-route not found'));
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    });
  });
});
