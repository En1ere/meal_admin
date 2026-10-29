import { useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRuntime } from '../../shared/runtime/index.js';
import { ApiError } from '../../shared/api/client.js';
import { PageLoader as ArcPageLoader } from '@meal-planner/design-system';
import { runReleaseCommand, stableUuid } from './api.js';
import { achievementIconUrl, groupLabels, releaseWorkspaceKey, useReleaseWorkspace } from './workspace.js';
import {
    contentDocumentSchema,
    dictionaryEntrySchema,
    type ContentDocument,
    type DictionaryEntry,
    type ReleaseChange,
} from './contracts.js';
import styles from './releases.module.css';
import { adminReleaseDraftKey } from '../../shared/storage/private-cache.js';
import {
    blankDictionaryEntry,
    blankDocument,
    changedFields,
    dictionaryLabels,
    namespaceLabels,
} from './release-model.js';
import { useReleaseDraft } from './use-release-draft.js';
import { ReleaseDetailHeader, ReleaseSidebar } from './release-sections.js';

export function ReleaseDetailPage() {
    const { id } = useParams();
    const workspace = useReleaseWorkspace();
    const { api, queryClient } = useRuntime();
    const navigate = useNavigate();
    const server = workspace.data?.releases.find((item) => item.id === id);
    const {
        title,
        setTitle,
        changes,
        setChanges,
        setBaseVersion,
        setClientRevision,
        saveStatus,
        setSaveStatus,
        error,
        setError,
        dirty,
        initializedRef,
        setHydratedRevision,
    } = useReleaseDraft(server, api, queryClient);
    const [pendingAction, setPendingAction] = useState('');
    const [legalKey, setLegalKey] = useState('');
    const [legalContent, setLegalContent] = useState('');
    const [legalEffectiveAt, setLegalEffectiveAt] = useState('');
    const [productId, setProductId] = useState('');
    const [productDescription, setProductDescription] = useState('');
    const [documentKey, setDocumentKey] = useState('');
    const [documentDraft, setDocumentDraft] = useState<ContentDocument>(() => blankDocument('help'));
    const [dictionaryKey, setDictionaryKey] = useState('');
    const [dictionaryDraft, setDictionaryDraft] = useState<DictionaryEntry>(() =>
        structuredClone(blankDictionaryEntry),
    );
    const [dictionaryIconPreview, setDictionaryIconPreview] = useState('');
    async function action(kind: 'validate' | 'publish' | 'rollback' | 'reopen') {
        if (!api || !server || dirty || pendingAction) return;
        setPendingAction(kind);
        setError('');
        try {
            const result = await runReleaseCommand(api, {
                action: kind,
                releaseId: server.id,
                expectedVersion: server.version,
                ...(kind === 'publish' || kind === 'rollback' ? { idempotencyKey: crypto.randomUUID() } : {}),
            } as Parameters<typeof runReleaseCommand>[1]);
            queryClient.setQueryData(releaseWorkspaceKey, result.workspace);
            if (kind === 'reopen') void navigate(`/admin/releases/${result.workspace.releases[0]!.id}`);
        } catch (failure) {
            setError(failure instanceof ApiError ? failure.message : 'Команда не выполнена.');
        } finally {
            setPendingAction('');
        }
    }
    async function loadServerVersion() {
        try {
            sessionStorage.removeItem(adminReleaseDraftKey);
        } catch {
            /* optional safety cache */
        }
        const result = await workspace.refetch();
        const latest = result.data?.releases.find((item) => item.id === id);
        if (!latest) {
            setError('Не удалось загрузить серверную версию.');
            return;
        }
        initializedRef.current = `${latest.id}:${latest.version}:${latest.clientRevision}`;
        setHydratedRevision(initializedRef.current);
        setTitle(latest.title);
        setChanges(latest.changes);
        setBaseVersion(latest.version);
        setClientRevision(latest.clientRevision);
        setSaveStatus('saved');
        setError('');
    }
    if (workspace.isPending) return <ArcPageLoader label="Загружаем релиз…" />;
    if (!server)
        return (
            <>
                <h1>Релиз не найден</h1>
            </>
        );
    const stagedIds = new Set(changes.filter((item) => item.entityType === 'achievement').map((item) => item.entityId));
    const addAchievement = (achievementId: string) => {
        const item = workspace.data?.achievements.find((achievement) => achievement.id === achievementId);
        if (!item || stagedIds.has(item.id)) return;
        const version = item.version;
        const achievement = {
            code: item.code,
            title: item.title,
            description: item.description,
            group: item.group,
            condition: item.condition,
            secret: item.secret,
            icon: item.icon,
        };
        setChanges((value) => [
            ...value,
            {
                entityType: 'achievement',
                entityId: item.id,
                label: item.title,
                changeType: 'update',
                expectedVersion: version,
                achievement,
            },
        ]);
    };
    const addLegal = () => {
        const source = workspace.data?.legalTexts.find((item) => item.key === legalKey);
        const key = legalKey.trim();
        if (!key || !legalContent.trim() || !legalEffectiveAt) return;
        const change: ReleaseChange = {
            entityType: 'legal_text',
            entityId: stableUuid(`document-${key}`),
            label: key,
            changeType: source ? 'update' : 'add',
            expectedVersion: source?.version ?? 0,
            summary: legalContent.trim(),
            effectiveAt: new Date(legalEffectiveAt).toISOString(),
        };
        setChanges((items) => [
            ...items.filter((item) => !(item.entityType === 'legal_text' && item.label === key)),
            change,
        ]);
    };
    const addProduct = () => {
        const source = workspace.data?.products.find((item) => item.id === productId);
        if (!source || !productDescription.trim()) return;
        const change: ReleaseChange = {
            entityType: 'product_description',
            entityId: source.id,
            label: source.name,
            changeType: source.description ? 'update' : 'add',
            expectedVersion: source.version,
            summary: productDescription.trim(),
        };
        setChanges((items) => [
            ...items.filter((item) => !(item.entityType === 'product_description' && item.entityId === source.id)),
            change,
        ]);
    };
    const selectDocument = (key: string) => {
        setDocumentKey(key);
        const source = workspace.data?.contentDocuments.find((item) => item.key === key);
        if (source) setDocumentDraft(structuredClone(source.value));
    };
    const stageDocument = (changeType?: 'retire') => {
        setError('');
        const key = documentKey.trim();
        const source = workspace.data?.contentDocuments.find((item) => item.key === key);
        if (!key || (changeType === 'retire' && !source)) return;
        if (key.length > 160) {
            setError('Ключ документа не может быть длиннее 160 символов.');
            return;
        }
        const documentPrefix = `${documentDraft.namespace}:${documentDraft.locale}:`;
        if (changeType !== 'retire' && (!key.startsWith(documentPrefix) || key.length === documentPrefix.length)) {
            setError(`Ключ документа должен иметь вид ${documentPrefix}<id>.`);
            return;
        }
        const parsed = contentDocumentSchema.safeParse(
            source && changeType === 'retire' ? source.value : documentDraft,
        );
        if (!parsed.success) {
            setError('Проверьте локаль, обязательные поля и metadata документа.');
            return;
        }
        const change: ReleaseChange = {
            entityType: 'content_document',
            entityId: stableUuid(`dictionary-${key}`),
            resourceKey: key,
            label: documentDraft.title,
            changeType: changeType ?? (source && !source.retired ? 'update' : 'add'),
            expectedVersion: source?.version ?? 0,
            document: parsed.data,
        };
        setChanges((items) => [
            ...items.filter(
                (item) => !(item.entityType === 'content_document' && item.resourceKey === change.resourceKey),
            ),
            change,
        ]);
    };
    const selectDictionaryEntry = (key: string) => {
        setDictionaryKey(key);
        const source = workspace.data?.dictionaryEntries.find((item) => item.key === key);
        if (source) {
            setDictionaryDraft(structuredClone(source.value));
            setDictionaryIconPreview('');
        }
    };
    const stageDictionaryEntry = (changeType?: 'retire') => {
        setError('');
        const key = dictionaryKey.trim();
        const source = workspace.data?.dictionaryEntries.find((item) => item.key === key);
        if (!key || (changeType === 'retire' && !source)) return;
        if (key.length > 160) {
            setError('Ключ записи не может быть длиннее 160 символов.');
            return;
        }
        const expectedKey = `${dictionaryDraft.dictionary}:${dictionaryDraft.code}`;
        if (changeType !== 'retire' && key !== expectedKey) {
            setError(`Ключ записи должен совпадать с ${expectedKey}.`);
            return;
        }
        const parsed = dictionaryEntrySchema.safeParse(
            source && changeType === 'retire' ? source.value : dictionaryDraft,
        );
        if (!parsed.success) {
            setError('Проверьте код, обязательные поля, порядок и metadata иконки записи.');
            return;
        }
        const change: ReleaseChange = {
            entityType: 'dictionary_entry',
            entityId: crypto.randomUUID(),
            resourceKey: key,
            label: dictionaryDraft.label,
            changeType: changeType ?? (source && !source.retired ? 'update' : 'add'),
            expectedVersion: source?.version ?? 0,
            entry: parsed.data,
        };
        setChanges((items) => [
            ...items.filter(
                (item) => !(item.entityType === 'dictionary_entry' && item.resourceKey === change.resourceKey),
            ),
            change,
        ]);
    };
    const previewDictionaryIcon = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.size > 1_048_576) {
            setError('Иконка справочника должна быть меньше 1 МБ.');
            return;
        }
        if (!['image/png', 'image/webp'].includes(file.type)) {
            setError('Для иконки справочника поддерживаются только PNG и WebP.');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' && setDictionaryIconPreview(reader.result);
        reader.onerror = () => setError('Не удалось прочитать иконку.');
        reader.readAsDataURL(file);
    };
    return (
        <>
            <ReleaseDetailHeader
                release={server}
                title={title}
                saveStatus={saveStatus}
                error={error}
                onBack={() => void navigate('/admin/releases')}
                onTitleChange={setTitle}
                onLoadServer={() => void loadServerVersion()}
                onUseLocal={() => {
                    setBaseVersion(server.version);
                    setSaveStatus('local');
                }}
            />
            <div className={styles.composition}>
                <section>
                    <div className={styles['section-heading']}>
                        <div>
                            <h2>Состав релиза</h2>
                            <p>Можно менять до проверки. Публикация применит весь набор атомарно.</p>
                        </div>
                    </div>
                    <details className={styles.bucket} open>
                        <summary>
                            <img src="/assets/achievements/medal-gold-chef.png" width="36" height="36" alt="" />
                            <strong>
                                Достижения · {changes.filter((item) => item.entityType === 'achievement').length}
                            </strong>
                            <small>
                                {changes.filter((item) => item.entityType === 'achievement').length} изменений
                            </small>
                        </summary>
                        <div className={styles['bucket-body']}>
                            {changes
                                .filter(
                                    (item): item is Extract<ReleaseChange, { entityType: 'achievement' }> =>
                                        item.entityType === 'achievement',
                                )
                                .map((change) => (
                                    <article className={styles['change-row']} key={change.entityId}>
                                        <span className={styles.icon}>
                                            <img
                                                src={achievementIconUrl(change.achievement.icon)}
                                                width="48"
                                                height="48"
                                                alt=""
                                            />
                                        </span>
                                        <div className={styles['change-copy']}>
                                            <strong>{change.achievement.title}</strong>
                                            <p>{change.achievement.description}</p>
                                        </div>
                                        <button
                                            className="button outline"
                                            disabled={server.status === 'published'}
                                            onClick={() =>
                                                setChanges((items) => items.filter((item) => item !== change))
                                            }
                                        >
                                            Убрать
                                        </button>
                                    </article>
                                ))}
                            <label>
                                Добавить из каталога
                                <select
                                    value=""
                                    disabled={server.status === 'published'}
                                    onChange={(event) => addAchievement(event.target.value)}
                                >
                                    <option value="">Выберите достижение</option>
                                    {workspace.data?.achievements
                                        .filter((item) => !stagedIds.has(item.id))
                                        .map((item) => (
                                            <option key={item.id} value={item.id}>
                                                {groupLabels[item.group]} · {item.title}
                                            </option>
                                        ))}
                                </select>
                            </label>
                        </div>
                    </details>
                    <details className={styles.bucket}>
                        <summary>
                            <img src="/assets/achievements/medal-silver-dialog.png" width="36" height="36" alt="" />
                            <strong>
                                Звания репутации · {changes.some((item) => item.entityType === 'reputation') ? 10 : 0}
                            </strong>
                            <small>
                                {changes.some((item) => item.entityType === 'reputation')
                                    ? '10 изменений'
                                    : 'Без изменений'}
                            </small>
                        </summary>
                        <div className={styles['bucket-body']}>
                            <p>В релиз попадёт полная шкала из 10 званий.</p>
                            <button
                                className="button outline"
                                disabled={
                                    server.status === 'published' ||
                                    changes.some((item) => item.entityType === 'reputation')
                                }
                                onClick={() =>
                                    setChanges((items) => [
                                        ...items,
                                        {
                                            entityType: 'reputation',
                                            entityId: '00000040-0000-4000-8000-000000000001',
                                            label: 'Шкала репутации',
                                            changeType: 'update',
                                            ranks: workspace.data!.ranks,
                                        },
                                    ])
                                }
                            >
                                Добавить актуальную шкалу
                            </button>
                        </div>
                    </details>
                    <details className={styles.bucket}>
                        <summary>
                            <img src="/assets/achievements/food-020.png" width="36" height="36" alt="" />
                            <strong>
                                Описания продуктов ·{' '}
                                {changes.filter((item) => item.entityType === 'product_description').length}
                            </strong>
                            <small>
                                {changes.filter((item) => item.entityType === 'product_description').length} изменений
                            </small>
                        </summary>
                        <div className={styles['bucket-body']}>
                            {changes
                                .filter((item) => item.entityType === 'product_description')
                                .map((item) => (
                                    <article className={styles['change-row']} key={item.entityId}>
                                        <div className={styles['change-copy']}>
                                            <strong>{item.label}</strong>
                                            <p>{item.summary}</p>
                                        </div>
                                        <button
                                            className="button outline"
                                            onClick={() => setChanges((all) => all.filter((value) => value !== item))}
                                        >
                                            Убрать
                                        </button>
                                    </article>
                                ))}
                            <label>
                                Продукт
                                <select
                                    value={productId}
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        setProductId(value);
                                        setProductDescription(
                                            workspace.data?.products.find((item) => item.id === value)?.description ??
                                                '',
                                        );
                                    }}
                                >
                                    <option value="">Выберите продукт</option>
                                    {workspace.data?.products.map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.name}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label>
                                Описание
                                <textarea
                                    value={productDescription}
                                    onChange={(event) => setProductDescription(event.target.value)}
                                />
                            </label>
                            <button
                                className="button outline"
                                disabled={!productId || !productDescription.trim()}
                                onClick={addProduct}
                            >
                                Добавить изменение
                            </button>
                        </div>
                    </details>
                    <details className={styles.bucket}>
                        <summary>
                            <img src="/assets/achievements/document.png" width="36" height="36" alt="" />
                            <strong>
                                Контентные документы ·{' '}
                                {changes.filter((item) => item.entityType === 'content_document').length}
                            </strong>
                            <small>
                                {changes.filter((item) => item.entityType === 'content_document').length} изменений
                            </small>
                        </summary>
                        <div className={styles['bucket-body']}>
                            {changes
                                .filter(
                                    (item): item is Extract<ReleaseChange, { entityType: 'content_document' }> =>
                                        item.entityType === 'content_document',
                                )
                                .map((item) => (
                                    <article className={styles['change-row']} key={item.resourceKey}>
                                        <div className={styles['change-copy']}>
                                            <strong>{item.label}</strong>
                                            <p>
                                                {item.changeType === 'retire' ? 'Снять' : 'Записать'} ·{' '}
                                                {namespaceLabels[item.document.namespace]} · {item.document.locale} ·{' '}
                                                {item.resourceKey}
                                            </p>
                                            <p>
                                                Было:{' '}
                                                {workspace.data?.contentDocuments.find(
                                                    (source) => source.key === item.resourceKey,
                                                )?.value.title ?? 'новый ресурс'}{' '}
                                                → Станет: {item.changeType === 'retire' ? 'снят' : item.document.title}{' '}
                                                · v{item.expectedVersion}
                                            </p>
                                            <p>
                                                {item.changeType === 'retire'
                                                    ? 'Diff: ресурс будет снят'
                                                    : `Diff: ${changedFields(
                                                          workspace.data?.contentDocuments.find(
                                                              (source) => source.key === item.resourceKey,
                                                          )?.value,
                                                          item.document,
                                                      ).join(', ')}`}
                                            </p>
                                        </div>
                                        <button
                                            className="button outline"
                                            disabled={server.status === 'published'}
                                            onClick={() => setChanges((all) => all.filter((value) => value !== item))}
                                        >
                                            Убрать
                                        </button>
                                    </article>
                                ))}
                            <div className={styles['editor-grid']}>
                                <label className={styles['wide-field']}>
                                    Ключ документа
                                    <input
                                        list="content-document-keys"
                                        value={documentKey}
                                        disabled={server.status === 'published'}
                                        onChange={(event) => selectDocument(event.target.value)}
                                        placeholder="help:ru-RU:sample-page"
                                    />
                                    <datalist id="content-document-keys">
                                        {workspace.data?.contentDocuments.map((item) => (
                                            <option key={item.key} value={item.key}>
                                                {item.value.title}
                                                {item.retired ? ' · снят' : ''}
                                            </option>
                                        ))}
                                    </datalist>
                                </label>
                                <label>
                                    Раздел
                                    <select
                                        value={documentDraft.namespace}
                                        disabled={server.status === 'published'}
                                        onChange={(event) =>
                                            setDocumentDraft(
                                                blankDocument(
                                                    event.target.value as ContentDocument['namespace'],
                                                    documentDraft,
                                                ),
                                            )
                                        }
                                    >
                                        {Object.entries(namespaceLabels).map(([value, label]) => (
                                            <option value={value} key={value}>
                                                {label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label>
                                    Локаль
                                    <input
                                        value={documentDraft.locale}
                                        pattern="[a-z]{2}(-[A-Z]{2})?"
                                        disabled={server.status === 'published'}
                                        onChange={(event) =>
                                            setDocumentDraft({ ...documentDraft, locale: event.target.value })
                                        }
                                    />
                                </label>
                                <label className={styles['wide-field']}>
                                    Заголовок
                                    <input
                                        value={documentDraft.title}
                                        maxLength={160}
                                        disabled={server.status === 'published'}
                                        onChange={(event) =>
                                            setDocumentDraft({ ...documentDraft, title: event.target.value })
                                        }
                                    />
                                </label>
                                {documentDraft.namespace === 'help' && (
                                    <>
                                        <label>
                                            Slug
                                            <input
                                                value={documentDraft.metadata.slug}
                                                disabled={server.status === 'published'}
                                                onChange={(event) =>
                                                    setDocumentDraft({
                                                        ...documentDraft,
                                                        metadata: {
                                                            ...documentDraft.metadata,
                                                            slug: event.target.value,
                                                        },
                                                    })
                                                }
                                            />
                                        </label>
                                        <label>
                                            Аудитория
                                            <select
                                                value={documentDraft.metadata.audience}
                                                disabled={server.status === 'published'}
                                                onChange={(event) =>
                                                    setDocumentDraft({
                                                        ...documentDraft,
                                                        metadata: {
                                                            ...documentDraft.metadata,
                                                            audience: event.target.value as 'all' | 'user' | 'admin',
                                                        },
                                                    })
                                                }
                                            >
                                                <option value="all">Все</option>
                                                <option value="user">Пользователи</option>
                                                <option value="admin">Администраторы</option>
                                            </select>
                                        </label>
                                    </>
                                )}
                                {documentDraft.namespace === 'pricing' && (
                                    <>
                                        <label>
                                            Тариф
                                            <select
                                                value={documentDraft.metadata.plan}
                                                disabled={server.status === 'published'}
                                                onChange={(event) =>
                                                    setDocumentDraft({
                                                        ...documentDraft,
                                                        metadata: {
                                                            ...documentDraft.metadata,
                                                            plan: event.target.value as 'free' | 'plus',
                                                        },
                                                    })
                                                }
                                            >
                                                <option value="free">Free</option>
                                                <option value="plus">Plus</option>
                                            </select>
                                        </label>
                                        <label>
                                            Период оплаты
                                            <select
                                                value={documentDraft.metadata.billingPeriod}
                                                disabled={server.status === 'published'}
                                                onChange={(event) =>
                                                    setDocumentDraft({
                                                        ...documentDraft,
                                                        metadata: {
                                                            ...documentDraft.metadata,
                                                            billingPeriod: event.target.value as
                                                                'none' | 'month' | 'year',
                                                        },
                                                    })
                                                }
                                            >
                                                <option value="none">Без периода</option>
                                                <option value="month">Месяц</option>
                                                <option value="year">Год</option>
                                            </select>
                                        </label>
                                    </>
                                )}
                                {documentDraft.namespace === 'onboarding' && (
                                    <>
                                        <label>
                                            Flow
                                            <input
                                                value={documentDraft.metadata.flow}
                                                disabled={server.status === 'published'}
                                                onChange={(event) =>
                                                    setDocumentDraft({
                                                        ...documentDraft,
                                                        metadata: {
                                                            ...documentDraft.metadata,
                                                            flow: event.target.value,
                                                        },
                                                    })
                                                }
                                            />
                                        </label>
                                        <label>
                                            Шаг
                                            <input
                                                type="number"
                                                min={1}
                                                step={1}
                                                value={documentDraft.metadata.step}
                                                disabled={server.status === 'published'}
                                                onChange={(event) =>
                                                    setDocumentDraft({
                                                        ...documentDraft,
                                                        metadata: {
                                                            ...documentDraft.metadata,
                                                            step: Math.max(1, Math.trunc(Number(event.target.value))),
                                                        },
                                                    })
                                                }
                                            />
                                        </label>
                                    </>
                                )}
                                {documentDraft.namespace === 'notification_template' && (
                                    <>
                                        <label>
                                            Канал
                                            <select
                                                value={documentDraft.metadata.channel}
                                                disabled={server.status === 'published'}
                                                onChange={(event) =>
                                                    setDocumentDraft({
                                                        ...documentDraft,
                                                        metadata: {
                                                            ...documentDraft.metadata,
                                                            channel: event.target.value as 'in_app' | 'email' | 'push',
                                                        },
                                                    })
                                                }
                                            >
                                                <option value="in_app">In-app</option>
                                                <option value="email">Email</option>
                                                <option value="push">Push</option>
                                            </select>
                                        </label>
                                        <label>
                                            Ключ шаблона
                                            <input
                                                value={documentDraft.metadata.templateKey}
                                                disabled={server.status === 'published'}
                                                onChange={(event) =>
                                                    setDocumentDraft({
                                                        ...documentDraft,
                                                        metadata: {
                                                            ...documentDraft.metadata,
                                                            templateKey: event.target.value,
                                                        },
                                                    })
                                                }
                                            />
                                        </label>
                                        <label className={styles['wide-field']}>
                                            Переменные через запятую
                                            <input
                                                value={documentDraft.metadata.variables.join(', ')}
                                                disabled={server.status === 'published'}
                                                onChange={(event) =>
                                                    setDocumentDraft({
                                                        ...documentDraft,
                                                        metadata: {
                                                            ...documentDraft.metadata,
                                                            variables: event.target.value
                                                                .split(',')
                                                                .map((value) => value.trim())
                                                                .filter(Boolean),
                                                        },
                                                    })
                                                }
                                            />
                                        </label>
                                    </>
                                )}
                                {documentDraft.namespace === 'feature_copy' && (
                                    <>
                                        <label>
                                            Ключ функции
                                            <input
                                                value={documentDraft.metadata.featureKey}
                                                disabled={server.status === 'published'}
                                                onChange={(event) =>
                                                    setDocumentDraft({
                                                        ...documentDraft,
                                                        metadata: {
                                                            ...documentDraft.metadata,
                                                            featureKey: event.target.value,
                                                        },
                                                    })
                                                }
                                            />
                                        </label>
                                        <label>
                                            Размещение
                                            <input
                                                value={documentDraft.metadata.placement}
                                                disabled={server.status === 'published'}
                                                onChange={(event) =>
                                                    setDocumentDraft({
                                                        ...documentDraft,
                                                        metadata: {
                                                            ...documentDraft.metadata,
                                                            placement: event.target.value,
                                                        },
                                                    })
                                                }
                                            />
                                        </label>
                                    </>
                                )}
                                <label className={styles['wide-field']}>
                                    Текст документа
                                    <textarea
                                        value={documentDraft.body}
                                        maxLength={200000}
                                        disabled={server.status === 'published'}
                                        onChange={(event) =>
                                            setDocumentDraft({ ...documentDraft, body: event.target.value })
                                        }
                                    />
                                </label>
                            </div>
                            <div className={styles['conflict-actions']}>
                                <button
                                    className="button outline"
                                    disabled={
                                        server.status === 'published' ||
                                        !documentKey.trim() ||
                                        !documentDraft.title.trim() ||
                                        !documentDraft.body.trim()
                                    }
                                    onClick={() => stageDocument()}
                                >
                                    Добавить изменение
                                </button>
                                <button
                                    className="button outline"
                                    disabled={
                                        server.status === 'published' ||
                                        !workspace.data?.contentDocuments.some(
                                            (item) => item.key === documentKey && !item.retired,
                                        )
                                    }
                                    onClick={() => stageDocument('retire')}
                                >
                                    Снять через релиз
                                </button>
                            </div>
                        </div>
                    </details>
                    <details className={styles.bucket}>
                        <summary>
                            <img src="/assets/achievements/food-087.png" width="36" height="36" alt="" />
                            <strong>
                                Справочники · {changes.filter((item) => item.entityType === 'dictionary_entry').length}
                            </strong>
                            <small>
                                {changes.filter((item) => item.entityType === 'dictionary_entry').length} изменений
                            </small>
                        </summary>
                        <div className={styles['bucket-body']}>
                            {changes
                                .filter(
                                    (item): item is Extract<ReleaseChange, { entityType: 'dictionary_entry' }> =>
                                        item.entityType === 'dictionary_entry',
                                )
                                .map((item) => (
                                    <article className={styles['change-row']} key={item.resourceKey}>
                                        <span className={styles.icon}>
                                            <img
                                                src={achievementIconUrl(item.entry.icon)}
                                                width="48"
                                                height="48"
                                                alt=""
                                            />
                                        </span>
                                        <div className={styles['change-copy']}>
                                            <strong>{item.entry.label}</strong>
                                            <p>
                                                {item.changeType === 'retire' ? 'Снять' : 'Записать'} ·{' '}
                                                {dictionaryLabels[item.entry.dictionary]} · {item.resourceKey}
                                            </p>
                                            <p>
                                                Было:{' '}
                                                {workspace.data?.dictionaryEntries.find(
                                                    (source) => source.key === item.resourceKey,
                                                )?.value.label ?? 'новый ресурс'}{' '}
                                                → Станет: {item.changeType === 'retire' ? 'снята' : item.entry.label} ·
                                                v{item.expectedVersion}
                                            </p>
                                            <p>
                                                {item.changeType === 'retire'
                                                    ? 'Diff: запись будет снята'
                                                    : `Diff: ${changedFields(
                                                          workspace.data?.dictionaryEntries.find(
                                                              (source) => source.key === item.resourceKey,
                                                          )?.value,
                                                          item.entry,
                                                      ).join(', ')}`}
                                            </p>
                                        </div>
                                        <button
                                            className="button outline"
                                            disabled={server.status === 'published'}
                                            onClick={() => setChanges((all) => all.filter((value) => value !== item))}
                                        >
                                            Убрать
                                        </button>
                                    </article>
                                ))}
                            <div className={styles['editor-grid']}>
                                <label className={styles['wide-field']}>
                                    Ключ записи
                                    <input
                                        list="dictionary-entry-keys"
                                        value={dictionaryKey}
                                        disabled={server.status === 'published'}
                                        onChange={(event) => selectDictionaryEntry(event.target.value)}
                                        placeholder="category:sample"
                                    />
                                    <datalist id="dictionary-entry-keys">
                                        {workspace.data?.dictionaryEntries.map((item) => (
                                            <option key={item.key} value={item.key}>
                                                {item.value.label}
                                                {item.retired ? ' · снята' : ''}
                                            </option>
                                        ))}
                                    </datalist>
                                </label>
                                <label>
                                    Справочник
                                    <select
                                        value={dictionaryDraft.dictionary}
                                        disabled={server.status === 'published'}
                                        onChange={(event) =>
                                            setDictionaryDraft({
                                                ...dictionaryDraft,
                                                dictionary: event.target.value as DictionaryEntry['dictionary'],
                                            })
                                        }
                                    >
                                        {Object.entries(dictionaryLabels).map(([value, label]) => (
                                            <option key={value} value={value}>
                                                {label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label>
                                    Код
                                    <input
                                        value={dictionaryDraft.code}
                                        maxLength={120}
                                        pattern="[a-z0-9]+([._-][a-z0-9]+)*"
                                        disabled={server.status === 'published'}
                                        onChange={(event) =>
                                            setDictionaryDraft({ ...dictionaryDraft, code: event.target.value })
                                        }
                                    />
                                </label>
                                <label>
                                    Название
                                    <input
                                        value={dictionaryDraft.label}
                                        maxLength={160}
                                        disabled={server.status === 'published'}
                                        onChange={(event) =>
                                            setDictionaryDraft({ ...dictionaryDraft, label: event.target.value })
                                        }
                                    />
                                </label>
                                <label>
                                    Порядок
                                    <input
                                        type="number"
                                        min={0}
                                        max={1000000}
                                        step={1}
                                        value={dictionaryDraft.sortOrder}
                                        disabled={server.status === 'published'}
                                        onChange={(event) =>
                                            setDictionaryDraft({
                                                ...dictionaryDraft,
                                                sortOrder: Math.max(0, Math.trunc(Number(event.target.value))),
                                            })
                                        }
                                    />
                                </label>
                                <label className={styles['wide-field']}>
                                    Описание
                                    <textarea
                                        value={dictionaryDraft.description ?? ''}
                                        maxLength={2000}
                                        disabled={server.status === 'published'}
                                        onChange={(event) =>
                                            setDictionaryDraft({
                                                ...dictionaryDraft,
                                                description: event.target.value || null,
                                            })
                                        }
                                    />
                                </label>
                                <label>
                                    Fallback-иконка
                                    <input
                                        value={dictionaryDraft.icon.fallbackKey}
                                        maxLength={80}
                                        disabled={server.status === 'published'}
                                        onChange={(event) =>
                                            setDictionaryDraft({
                                                ...dictionaryDraft,
                                                icon: {
                                                    ...dictionaryDraft.icon,
                                                    fallbackKey: event.target.value,
                                                },
                                            })
                                        }
                                    />
                                </label>
                                <label>
                                    Alt иконки
                                    <input
                                        value={dictionaryDraft.icon.alt}
                                        maxLength={200}
                                        disabled={server.status === 'published'}
                                        onChange={(event) =>
                                            setDictionaryDraft({
                                                ...dictionaryDraft,
                                                icon: { ...dictionaryDraft.icon, alt: event.target.value },
                                            })
                                        }
                                    />
                                </label>
                                <div className={styles['icon-preview']}>
                                    <img
                                        src={dictionaryIconPreview || achievementIconUrl(dictionaryDraft.icon)}
                                        width="64"
                                        height="64"
                                        alt={`Предпросмотр: ${dictionaryDraft.icon.alt}`}
                                    />
                                    <label className="button outline">
                                        Предпросмотр PNG/WebP
                                        <input
                                            className={styles['file-input']}
                                            type="file"
                                            accept="image/png,image/webp"
                                            disabled={
                                                server.status === 'published' ||
                                                !(import.meta.env.DEV && import.meta.env.VITE_API_MODE === 'mock')
                                            }
                                            onChange={previewDictionaryIcon}
                                        />
                                    </label>
                                    <small className={styles['icon-preview-note']}>
                                        {import.meta.env.DEV && import.meta.env.VITE_API_MODE === 'mock'
                                            ? 'Файл используется только для локального предпросмотра.'
                                            : 'Upload недоступен до подключения storage и scanner.'}
                                    </small>
                                </div>
                                <label className={styles['toggle-field']}>
                                    <input
                                        className={styles['toggle-control']}
                                        type="checkbox"
                                        checked={dictionaryDraft.enabled}
                                        disabled={server.status === 'published'}
                                        onChange={(event) =>
                                            setDictionaryDraft({
                                                ...dictionaryDraft,
                                                enabled: event.target.checked,
                                            })
                                        }
                                    />
                                    Запись включена
                                </label>
                            </div>
                            <div className={styles['conflict-actions']}>
                                <button
                                    className="button outline"
                                    disabled={
                                        server.status === 'published' ||
                                        !dictionaryKey.trim() ||
                                        !dictionaryDraft.code ||
                                        !dictionaryDraft.label.trim()
                                    }
                                    onClick={() => stageDictionaryEntry()}
                                >
                                    Добавить изменение
                                </button>
                                <button
                                    className="button outline"
                                    disabled={
                                        server.status === 'published' ||
                                        !workspace.data?.dictionaryEntries.some(
                                            (item) => item.key === dictionaryKey && !item.retired,
                                        )
                                    }
                                    onClick={() => stageDictionaryEntry('retire')}
                                >
                                    Снять через релиз
                                </button>
                            </div>
                        </div>
                    </details>
                    <details className={styles.bucket}>
                        <summary>
                            <img src="/assets/achievements/document.png" width="36" height="36" alt="" />
                            <strong>
                                Юридические тексты · {changes.filter((item) => item.entityType === 'legal_text').length}
                            </strong>
                            <small>{changes.filter((item) => item.entityType === 'legal_text').length} изменений</small>
                        </summary>
                        <div className={styles['bucket-body']}>
                            {changes
                                .filter((item) => item.entityType === 'legal_text')
                                .map((item) => (
                                    <article className={styles['change-row']} key={item.entityId}>
                                        <div className={styles['change-copy']}>
                                            <strong>{item.label}</strong>
                                            <p>Вступает {new Date(item.effectiveAt).toLocaleString('ru-RU')}</p>
                                        </div>
                                        <button
                                            className="button outline"
                                            onClick={() => setChanges((all) => all.filter((value) => value !== item))}
                                        >
                                            Убрать
                                        </button>
                                    </article>
                                ))}
                            <label>
                                Тип документа
                                <input
                                    list="legal-source-keys"
                                    value={legalKey}
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        setLegalKey(value);
                                        const source = workspace.data?.legalTexts.find((item) => item.key === value);
                                        setLegalContent(source?.content ?? '');
                                    }}
                                />
                                <datalist id="legal-source-keys">
                                    {workspace.data?.legalTexts.map((item) => (
                                        <option key={item.key} value={item.key} />
                                    ))}
                                </datalist>
                            </label>
                            <label>
                                Текст
                                <textarea
                                    value={legalContent}
                                    onChange={(event) => setLegalContent(event.target.value)}
                                />
                            </label>
                            <label>
                                Дата вступления (локальное время администратора)
                                <input
                                    type="datetime-local"
                                    value={legalEffectiveAt}
                                    onChange={(event) => setLegalEffectiveAt(event.target.value)}
                                />
                            </label>
                            {legalEffectiveAt && (
                                <p className={styles.muted}>
                                    Будет сохранено в UTC: {new Date(legalEffectiveAt).toISOString()}
                                </p>
                            )}
                            <button
                                className="button outline"
                                disabled={!legalKey.trim() || !legalContent.trim() || !legalEffectiveAt}
                                onClick={addLegal}
                            >
                                Добавить изменение
                            </button>
                        </div>
                    </details>
                </section>
                <ReleaseSidebar
                    release={server}
                    changes={changes}
                    dirty={dirty}
                    pendingAction={pendingAction}
                    onAction={(kind) => void action(kind)}
                />
            </div>
        </>
    );
}
