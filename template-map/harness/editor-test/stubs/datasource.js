const chain = new Proxy(function () {}, { get: () => chain, apply: () => chain });
export const q = chain;
export const useRecords = () => ({ data: null, isLoading: false }); export const useRecordUpdate = () => ({ mutate: () => {}, mutateAsync: async () => {} });
export const useUpload = () => ({ upload: async () => {} }); export const useFieldOptions = () => ({ data: [] });
