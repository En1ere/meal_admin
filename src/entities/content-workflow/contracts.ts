import { z } from 'zod';

export const contentSectionSchema = z.enum(['queues', 'catalog']);
export type ContentSection = z.infer<typeof contentSectionSchema>;
export const contentParamsSchema = z.strictObject({ section: contentSectionSchema, id: z.uuid() });
const fields = z.record(z.string(), z.string().nullable());
export const contentRevisionSchema = z.strictObject({ id: z.uuid(), version: z.number().int().positive(), fields });
export const contentReviewSchema = z.strictObject({
    revisionId: z.uuid(),
    status: z.string(),
    publicReason: z.string().nullable(),
    revision: contentRevisionSchema,
});
export const contentPublicationSchema = z.strictObject({
    revisionId: z.uuid(),
    publishedAt: z.iso.datetime(),
    revision: contentRevisionSchema,
});
export const contentCardSchema = z.strictObject({
    id: z.uuid(),
    version: z.number().int().positive(),
    name: z.string(),
    fields,
    variants: z.array(z.string()),
    authors: z.array(z.string()),
    sources: z.array(z.string()),
    aliasOf: z.uuid().nullable(),
});
export const contentResultSchema = z.strictObject({
    section: contentSectionSchema,
    id: z.uuid(),
    version: z.number().int().positive(),
    current: contentRevisionSchema.nullable(),
    pending: contentRevisionSchema.nullable(),
    review: contentReviewSchema.nullable().optional(),
    publication: contentPublicationSchema.nullable().optional(),
    status: z.string(),
    history: z.array(
        z.strictObject({ action: z.string(), reason: z.string(), actor: z.string(), at: z.iso.datetime() }),
    ),
    cards: z.array(contentCardSchema),
    comparison: z
        .strictObject({
            left: contentCardSchema,
            right: contentCardSchema,
            conflicts: z.array(z.string()),
            blockedReason: z.string().nullable(),
            resolved: fields,
            canonicalId: z.uuid(),
            previewKey: z.string(),
        })
        .nullable(),
    message: z.string(),
});
const key = { idempotencyKey: z.uuid() };
export const contentModerateSchema = z
    .strictObject({
        action: z.enum(['approve', 'reject', 'hide', 'unpublish']),
        version: z.number().int().positive(),
        reason: z.string().trim().max(2000),
        publicReason: z.string().trim().min(3).max(500).nullable().optional(),
        ...key,
    })
    .refine((command) => command.action === 'approve' || command.reason.length > 0, 'Укажите причину');
export const contentCompareSchema = z.strictObject({
    leftId: z.uuid(),
    rightId: z.uuid(),
    leftVersion: z.number().int().positive(),
    rightVersion: z.number().int().positive(),
    canonicalId: z.uuid(),
    choices: z.record(z.string(), z.enum(['left', 'right'])),
});
export const contentMergeSchema = contentCompareSchema.extend({
    previewKey: z.string().min(1),
    reason: z.string().trim().min(1).max(2000),
    ...key,
});
export const contentNotDuplicateSchema = z.strictObject({
    leftId: z.uuid(),
    rightId: z.uuid(),
    leftVersion: z.number().int().positive(),
    rightVersion: z.number().int().positive(),
    reason: z.string().trim().min(1).max(2000),
    ...key,
});

export type ContentResult = z.infer<typeof contentResultSchema>;
export type ContentCard = z.infer<typeof contentCardSchema>;
export type ContentCompare = z.infer<typeof contentCompareSchema>;
export type ContentMutatingCommand =
    | { action: 'moderate'; data: z.infer<typeof contentModerateSchema> }
    | { action: 'merge'; data: z.infer<typeof contentMergeSchema> }
    | { action: 'not-duplicate'; data: z.infer<typeof contentNotDuplicateSchema> };
export type ContentCommand = { action: 'load' } | { action: 'compare'; data: ContentCompare } | ContentMutatingCommand;

export const isContentMutatingCommand = (command: ContentCommand): command is ContentMutatingCommand =>
    command.action === 'moderate' || command.action === 'merge' || command.action === 'not-duplicate';

export const contentCommandIntent = (command: ContentMutatingCommand): string =>
    JSON.stringify({ ...command, data: { ...command.data, idempotencyKey: '' } });

export const contentForbiddenRecovery = (
    criticalUntil: string | null | undefined,
    now = Date.now(),
): 'reconfirm' | 'access-denied' => (criticalUntil && Date.parse(criticalUntil) > now ? 'access-denied' : 'reconfirm');

export type ContentModerationAction = z.infer<typeof contentModerateSchema>['action'];

export const contentReviewStatusLabel = (status: string): string =>
    ({
        queued: 'В очереди',
        pending: 'Ожидает проверки',
        in_review: 'На проверке',
        approved: 'Одобрено, ожидает публикации',
        published: 'Опубликовано',
        rejected: 'Отклонено',
        hidden: 'Рецепт скрыт целиком',
        unpublished: 'Публикация снята',
    })[status] ?? status;

export const contentActionAvailable = (result: ContentResult, action: ContentModerationAction): boolean => {
    if (action === 'approve' || action === 'reject')
        return (
            !!(result.review?.revision ?? result.pending) &&
            ['queued', 'pending', 'in_review', 'approved'].includes(result.review?.status ?? result.status)
        );
    if (!(result.publication?.revision ?? result.current) || result.status !== 'published') return false;
    return !result.review || !result.publication || result.review.revisionId === result.publication.revisionId;
};
