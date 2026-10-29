type AllergenAssetAdapter = (checksum: string, dataUrl: string) => void;

let allergenAssetAdapter: AllergenAssetAdapter | null = null;

export function configureAllergenAssetAdapter(adapter: AllergenAssetAdapter | null) {
    allergenAssetAdapter = adapter;
}

export function stageAllergenAsset(checksum: string, dataUrl: string) {
    allergenAssetAdapter?.(checksum, dataUrl);
}
