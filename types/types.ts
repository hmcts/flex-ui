export interface CaseField {
    CaseTypeID: string
    ID: string
    Label: string
    HintText?: string
    FieldType?: string
    FieldTypeParameter?: string
    RegularExpression?: string
    SecurityClassification: "Public"
    Min?: number
    Max?: number
}

export interface AuthorisationCaseField {
    CaseTypeId: string
    CaseFieldID: string
    UserRole: string
    CRUD: string
}

export interface CaseEventToField {
    CaseTypeID: string
    CaseEventID: string
    CaseFieldID: string
    DisplayContext: 'READONLY' | 'OPTIONAL' | 'MANDATORY'
    PageID: number
    PageDisplayOrder: number
    PageFieldDisplayOrder: number
    FieldShowCondition?: string | null
    PageShowCondition?: string | null
    RetainHiddenValue?: 'Yes' | 'No' | null
    ShowSummaryChangeOption?: 'Y' | 'N' | null
    CallBackURLMidEvent?: string | null
    PageLabel?: string | null
    PageColumnNumber?: number | null
    ShowSummaryContentOption?: number | null
    RetriesTimeoutURLMidEvent?: string | null
}

export interface Scrubbed {
    ID: string
    ListElementCode: string
    ListElement: string
    DisplayOrder: number
}

export enum SaveMode {
    ENGLANDWALES = 1,
    SCOTLAND = 2,
    BOTH = 0
}