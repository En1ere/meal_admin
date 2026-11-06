import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import * as contentReleaseContracts from '../src/entities/content-release/contracts.js';
import * as contentReleaseModel from '../src/entities/content-release/model.js';
import * as contentReleaseQueryKeys from '../src/entities/content-release/query-keys.js';
import {
    achievementClauseSchema,
    achievementConditionSchema,
    achievementGroupSchema,
    achievementMetricSchema,
    achievementSchema,
    canonicalAchievementPayloadSchema,
    canonicalDetailSchema,
    canonicalHistorySchema,
    canonicalListSchema,
    canonicalPatchSchema,
    canonicalSourcesSchema,
    canonicalSummarySchema,
    conditionModel,
    conditionPayload,
    contentDocumentSchema,
    contentReleaseKeys,
    dictionaryEntrySchema,
    envelope,
    releaseAckEnvelopeSchema,
    releaseAckSchema,
    releaseCommandSchema,
    releaseEnvelopeSchema,
    releaseSchema,
    releaseWorkspaceSchema,
    reputationRankSchema,
    serializeChanges,
    stableUuid,
    type Achievement,
    type AchievementClause,
    type AchievementCondition,
    type AchievementMetric,
    type CanonicalPatch,
    type ContentDocument,
    type DictionaryEntry,
    type Release,
    type ReleaseAck,
    type ReleaseChange,
    type ReleaseCommand,
    type ReleaseWorkspace,
    type ReputationRank,
} from '../src/entities/content-release/index.js';
import * as contentWorkflowContracts from '../src/entities/content-workflow/contracts.js';
import * as contentWorkflowQueryKeys from '../src/entities/content-workflow/query-keys.js';
import {
    contentActionAvailable,
    contentCardSchema,
    contentCommandIntent,
    contentCompareSchema,
    contentForbiddenRecovery,
    contentMergeSchema,
    contentModerateSchema,
    contentNotDuplicateSchema,
    contentParamsSchema,
    contentPublicationSchema,
    contentResultSchema,
    contentReviewSchema,
    contentReviewStatusLabel,
    contentRevisionSchema,
    contentSectionSchema,
    contentWorkflowKeys,
    isContentMutatingCommand,
    type ContentCard,
    type ContentCommand,
    type ContentCompare,
    type ContentModerationAction,
    type ContentMutatingCommand,
    type ContentResult,
    type ContentSection,
} from '../src/entities/content-workflow/index.js';
import * as newsContracts from '../src/entities/news/contracts.js';
import {
    newsAudienceSchema,
    newsCommandSchema,
    newsContentSchema,
    newsItemSchema,
    newsResultSchema,
    type NewsCommand,
    type NewsContent,
    type NewsItem,
    type NewsResult,
} from '../src/entities/news/index.js';
import * as operationContracts from '../src/entities/operation/contracts.js';
import {
    operationSchema,
    operationsCommandSchema,
    operationsResultSchema,
    type Operation,
    type OperationsResult,
} from '../src/entities/operation/index.js';

const operationPublicValues = { operationSchema, operationsCommandSchema, operationsResultSchema };
const newsPublicValues = {
    newsAudienceSchema,
    newsCommandSchema,
    newsContentSchema,
    newsItemSchema,
    newsResultSchema,
};
const contentWorkflowPublicValues = {
    contentActionAvailable,
    contentCardSchema,
    contentCommandIntent,
    contentCompareSchema,
    contentForbiddenRecovery,
    contentMergeSchema,
    contentModerateSchema,
    contentNotDuplicateSchema,
    contentParamsSchema,
    contentPublicationSchema,
    contentResultSchema,
    contentReviewSchema,
    contentReviewStatusLabel,
    contentRevisionSchema,
    contentSectionSchema,
    isContentMutatingCommand,
};
const contentReleasePublicValues = {
    achievementClauseSchema,
    achievementConditionSchema,
    achievementGroupSchema,
    achievementMetricSchema,
    achievementSchema,
    canonicalAchievementPayloadSchema,
    canonicalDetailSchema,
    canonicalHistorySchema,
    canonicalListSchema,
    canonicalPatchSchema,
    canonicalSourcesSchema,
    canonicalSummarySchema,
    contentDocumentSchema,
    dictionaryEntrySchema,
    envelope,
    releaseAckEnvelopeSchema,
    releaseAckSchema,
    releaseCommandSchema,
    releaseEnvelopeSchema,
    releaseSchema,
    releaseWorkspaceSchema,
    reputationRankSchema,
};

void test('operation and news public indexes preserve every contract runtime export by identity', () => {
    assert.deepEqual(Object.keys(operationPublicValues).sort(), Object.keys(operationContracts).sort());
    assert.deepEqual(Object.keys(newsPublicValues).sort(), Object.keys(newsContracts).sort());
    for (const name of Object.keys(operationPublicValues) as Array<keyof typeof operationPublicValues>)
        assert.strictEqual(operationPublicValues[name], operationContracts[name]);
    for (const name of Object.keys(newsPublicValues) as Array<keyof typeof newsPublicValues>)
        assert.strictEqual(newsPublicValues[name], newsContracts[name]);
});

void test('content workflow public index preserves every contract and query-key runtime export by identity', () => {
    assert.deepEqual(Object.keys(contentWorkflowPublicValues).sort(), Object.keys(contentWorkflowContracts).sort());
    for (const name of Object.keys(contentWorkflowPublicValues) as Array<keyof typeof contentWorkflowPublicValues>)
        assert.strictEqual(contentWorkflowPublicValues[name], contentWorkflowContracts[name]);
    assert.deepEqual(Object.keys(contentWorkflowQueryKeys), ['contentWorkflowKeys']);
    assert.strictEqual(contentWorkflowKeys, contentWorkflowQueryKeys.contentWorkflowKeys);
});

void test('content release public index preserves every contracts, model and query-key runtime export by identity', () => {
    assert.deepEqual(Object.keys(contentReleasePublicValues).sort(), Object.keys(contentReleaseContracts).sort());
    for (const name of Object.keys(contentReleasePublicValues) as Array<keyof typeof contentReleasePublicValues>)
        assert.strictEqual(contentReleasePublicValues[name], contentReleaseContracts[name]);
    const modelValues = { conditionModel, conditionPayload, serializeChanges, stableUuid };
    assert.deepEqual(Object.keys(modelValues).sort(), Object.keys(contentReleaseModel).sort());
    for (const name of Object.keys(modelValues) as Array<keyof typeof modelValues>)
        assert.strictEqual(modelValues[name], contentReleaseModel[name]);
    assert.deepEqual(Object.keys(contentReleaseQueryKeys), ['contentReleaseKeys']);
    assert.strictEqual(contentReleaseKeys, contentReleaseQueryKeys.contentReleaseKeys);
});

void test('operation and news public indexes keep exhaustive named type exports without wildcard exports', async () => {
    const [operationIndex, newsIndex, contentWorkflowIndex, contentReleaseIndex] = await Promise.all([
        readFile(resolve('src/entities/operation/index.ts'), 'utf8'),
        readFile(resolve('src/entities/news/index.ts'), 'utf8'),
        readFile(resolve('src/entities/content-workflow/index.ts'), 'utf8'),
        readFile(resolve('src/entities/content-release/index.ts'), 'utf8'),
    ]);
    assert.doesNotMatch(operationIndex, /export\s+\*/u);
    assert.doesNotMatch(newsIndex, /export\s+\*/u);
    for (const name of ['Operation', 'OperationsResult'])
        assert.match(operationIndex, new RegExp(`type ${name}\\b`, 'u'));
    for (const name of ['NewsCommand', 'NewsContent', 'NewsItem', 'NewsResult'])
        assert.match(newsIndex, new RegExp(`type ${name}\\b`, 'u'));
    assert.doesNotMatch(contentWorkflowIndex, /export\s+\*/u);
    for (const name of [
        'ContentCard',
        'ContentCommand',
        'ContentCompare',
        'ContentModerationAction',
        'ContentMutatingCommand',
        'ContentResult',
        'ContentSection',
    ])
        assert.match(contentWorkflowIndex, new RegExp(`type ${name}\\b`, 'u'));
    assert.doesNotMatch(contentReleaseIndex, /export\s+\*/u);
    for (const name of [
        'Achievement',
        'AchievementClause',
        'AchievementCondition',
        'AchievementMetric',
        'CanonicalPatch',
        'ContentDocument',
        'DictionaryEntry',
        'Release',
        'ReleaseAck',
        'ReleaseChange',
        'ReleaseCommand',
        'ReleaseWorkspace',
        'ReputationRank',
    ])
        assert.match(contentReleaseIndex, new RegExp(`type ${name}\\b`, 'u'));
});

void test('operation and news public type exports remain assignable to their inferred contracts', () => {
    type ExpectedOperation = (typeof operationSchema)['_output'];
    type ExpectedOperationsResult = (typeof operationsResultSchema)['_output'];
    type ExpectedNewsCommand = (typeof newsCommandSchema)['_output'];
    type ExpectedNewsContent = (typeof newsContentSchema)['_output'];
    type ExpectedNewsItem = (typeof newsItemSchema)['_output'];
    type ExpectedNewsResult = (typeof newsResultSchema)['_output'];
    const operation: Operation extends ExpectedOperation ? true : false = true;
    const operationsResult: OperationsResult extends ExpectedOperationsResult ? true : false = true;
    const newsCommand: NewsCommand extends ExpectedNewsCommand ? true : false = true;
    const newsContent: NewsContent extends ExpectedNewsContent ? true : false = true;
    const newsItem: NewsItem extends ExpectedNewsItem ? true : false = true;
    const newsResult: NewsResult extends ExpectedNewsResult ? true : false = true;
    assert.deepEqual(
        { operation, operationsResult, newsCommand, newsContent, newsItem, newsResult },
        {
            operation: true,
            operationsResult: true,
            newsCommand: true,
            newsContent: true,
            newsItem: true,
            newsResult: true,
        },
    );
});

void test('content workflow public type exports remain assignable to their inferred contracts', () => {
    type ExpectedCard = (typeof contentCardSchema)['_output'];
    type ExpectedCompare = (typeof contentCompareSchema)['_output'];
    type ExpectedResult = (typeof contentResultSchema)['_output'];
    type ExpectedSection = (typeof contentSectionSchema)['_output'];
    type ExpectedModerationAction = (typeof contentModerateSchema)['_output']['action'];
    const card: ContentCard extends ExpectedCard ? true : false = true;
    const compare: ContentCompare extends ExpectedCompare ? true : false = true;
    const result: ContentResult extends ExpectedResult ? true : false = true;
    const section: ContentSection extends ExpectedSection ? true : false = true;
    const moderation: ContentModerationAction extends ExpectedModerationAction ? true : false = true;
    const command: ContentCommand extends { action: string } ? true : false = true;
    const mutating: ContentMutatingCommand extends ContentCommand ? true : false = true;
    assert.deepEqual(
        { card, compare, result, section, moderation, command, mutating },
        { card: true, compare: true, result: true, section: true, moderation: true, command: true, mutating: true },
    );
});

void test('content release public type exports remain assignable to their inferred contracts', () => {
    const checks: {
        achievement: Achievement extends (typeof achievementSchema)['_output'] ? true : false;
        clause: AchievementClause extends (typeof achievementClauseSchema)['_output'] ? true : false;
        condition: AchievementCondition extends (typeof achievementConditionSchema)['_output'] ? true : false;
        metric: AchievementMetric extends (typeof achievementMetricSchema)['_output'] ? true : false;
        canonicalPatch: CanonicalPatch extends (typeof canonicalPatchSchema)['_output'] ? true : false;
        contentDocument: ContentDocument extends (typeof contentDocumentSchema)['_output'] ? true : false;
        dictionaryEntry: DictionaryEntry extends (typeof dictionaryEntrySchema)['_output'] ? true : false;
        release: Release extends (typeof releaseSchema)['_output'] ? true : false;
        ack: ReleaseAck extends (typeof releaseAckSchema)['_output'] ? true : false;
        command: ReleaseCommand extends (typeof releaseCommandSchema)['_output'] ? true : false;
        workspace: ReleaseWorkspace extends (typeof releaseWorkspaceSchema)['_output'] ? true : false;
        rank: ReputationRank extends (typeof reputationRankSchema)['_output'] ? true : false;
        change: ReleaseChange extends Release['changes'][number] ? true : false;
    } = {
        achievement: true,
        clause: true,
        condition: true,
        metric: true,
        canonicalPatch: true,
        contentDocument: true,
        dictionaryEntry: true,
        release: true,
        ack: true,
        command: true,
        workspace: true,
        rank: true,
        change: true,
    };
    assert.equal(Object.values(checks).every(Boolean), true);
});
