import styles from './admin-record.module.css';
import { displayField, type AdminRecord } from '../../entities/admin-record/index.js';

export function Fields({ item }: { item: AdminRecord }) {
    return (
        <dl className={styles.fields}>
            {item.fields.map((field, index) => {
                const display = displayField(field, item.fields);
                return (
                    <div key={`${field.key}-${index}`}>
                        <dt>{display.label}</dt>
                        <dd>{display.value}</dd>
                    </div>
                );
            })}
        </dl>
    );
}
