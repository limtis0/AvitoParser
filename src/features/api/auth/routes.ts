import { app } from "@/index";
import { config } from '@/features/config';
import argon2 from 'argon2';
import crypto from 'crypto';

export default function registerAuthRoutes() {
    app.get('/api/user/exists', async (_request, reply) => {
        return reply.code(200).send({
            exists: config.store.auth.passwordHash !== null
        });
    });

    app.put<{
        Body: { password: string }
    }>('/api/user/password', {
        schema: {
            body: {
                type: 'object',
                required: ['password'],
                properties: {
                    password: { type: 'string', minLength: 8 }
                }
            }
        }
    }, async (request, reply) => {
        const auth = config.store.auth;

        if (auth.passwordHash !== null) {
            return reply.code(404).send();
        }

        auth.passwordHash = await argon2.hash(request.body.password);
        config.set('auth', auth);

        return reply.code(200).send();
    });

    app.post<{
        Body: {
            username: string;
            password: string;
        }
    }>('/api/user/signIn', {
        schema: {
            body: {
                type: 'object',
                required: ['username', 'password'],
                properties: {
                    username: { type: 'string' },
                    password: { type: 'string' }
                }
            }
        }
    }, async (request, reply) => {
        const auth = config.store.auth;

        if (auth.passwordHash === null) {
            return reply.code(400).send({
                error: 'Создайте пользователя и попробуйте ещё раз'
            });
        }

        const { username, password } = request.body;
        const correctPassword = await argon2.verify(auth.passwordHash, password);

        if (username !== auth.username || !correctPassword) {
            return reply.code(401).send({
                error: 'Неверные данные'
            });
        }

        // Generate new apiKey
        if (auth.apiKey === null) {
            auth.apiKey = crypto.randomBytes(16).toString('hex');
            config.set('auth', auth);
        }

        return reply.code(200).send({
            apiKey: auth.apiKey
        });
    });

    app.put<{
        Body: {
            currentPassword: string;
            newPassword: string;
        }
    }>('/api/user/changePassword', {
        onRequest: [app.auth()],
        schema: {
            body: {
                type: 'object',
                required: ['newPassword', 'currentPassword'],
                properties: {
                    currentPassword: { type: 'string', minLength: 8 },
                    newPassword: { type: 'string', minLength: 8 }
                }
            }
        }
    }, async (request, reply) => {
        const auth = config.store.auth;
        const { currentPassword, newPassword } = request.body;

        const correctPassword = await argon2.verify(auth.passwordHash!, currentPassword);

        if (!correctPassword) {
            return reply.code(401).send({
                error: 'Неверный пароль'
            });
        }

        auth.passwordHash = await argon2.hash(newPassword);
        config.set('auth', auth);

        return reply.code(200).send();
    });
}