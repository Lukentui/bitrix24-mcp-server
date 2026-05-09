export interface BitrixContact {
    ID?: string;
    NAME?: string;
    LAST_NAME?: string;
    PHONE?: Array<{
        VALUE: string;
        VALUE_TYPE: string;
    }>;
    EMAIL?: Array<{
        VALUE: string;
        VALUE_TYPE: string;
    }>;
    COMPANY_TITLE?: string;
    POST?: string;
    COMMENTS?: string;
    DATE_CREATE?: string;
    DATE_MODIFY?: string;
}
export interface BitrixDeal {
    ID?: string;
    TITLE?: string;
    STAGE_ID?: string;
    OPPORTUNITY?: string;
    CURRENCY_ID?: string;
    CONTACT_ID?: string;
    COMPANY_ID?: string;
    BEGINDATE?: string;
    CLOSEDATE?: string;
    COMMENTS?: string;
    DATE_CREATE?: string;
    DATE_MODIFY?: string;
    ASSIGNED_BY_ID?: string;
    CREATED_BY_ID?: string;
    MODIFY_BY_ID?: string;
}
export interface BitrixLead {
    ID?: string;
    TITLE?: string;
    NAME?: string;
    LAST_NAME?: string;
    SECOND_NAME?: string;
    COMPANY_TITLE?: string;
    SOURCE_ID?: string;
    STATUS_ID?: string;
    STATUS_SEMANTIC_ID?: string;
    OPPORTUNITY?: string;
    CURRENCY_ID?: string;
    PHONE?: Array<{
        VALUE: string;
        VALUE_TYPE: string;
    }>;
    EMAIL?: Array<{
        VALUE: string;
        VALUE_TYPE: string;
    }>;
    ASSIGNED_BY_ID?: string;
    CREATED_BY_ID?: string;
    MODIFY_BY_ID?: string;
    DATE_CREATE?: string;
    DATE_MODIFY?: string;
    DATE_CLOSED?: string;
    COMMENTS?: string;
    OPENED?: string;
}
export interface BitrixTask {
    ID?: string;
    TITLE?: string;
    DESCRIPTION?: string;
    RESPONSIBLE_ID?: string;
    DEADLINE?: string;
    PRIORITY?: '0' | '1' | '2';
    STATUS?: '1' | '2' | '3' | '4' | '5';
    STAGE?: string;
    UF_CRM_TASK?: string[];
}
export interface BitrixCompany {
    ID?: string;
    TITLE?: string;
    COMPANY_TYPE?: string;
    INDUSTRY?: string;
    PHONE?: Array<{
        VALUE: string;
        VALUE_TYPE: string;
    }>;
    EMAIL?: Array<{
        VALUE: string;
        VALUE_TYPE: string;
    }>;
    WEB?: Array<{
        VALUE: string;
        VALUE_TYPE: string;
    }>;
    ADDRESS?: string;
    EMPLOYEES?: string;
    REVENUE?: string;
    COMMENTS?: string;
    ASSIGNED_BY_ID?: string;
    CREATED_BY_ID?: string;
    MODIFY_BY_ID?: string;
    DATE_CREATE?: string;
    DATE_MODIFY?: string;
}
export declare class Bitrix24Client {
    private baseUrl;
    private requestCount;
    private lastRequestTime;
    private readonly RATE_LIMIT_DELAY;
    constructor(webhookUrl?: string);
    private enforceRateLimit;
    private makeRequest;
    createContact(contact: BitrixContact): Promise<string>;
    getContact(id: string): Promise<BitrixContact>;
    updateContact(id: string, contact: Partial<BitrixContact>): Promise<boolean>;
    listContacts(params?: {
        start?: number;
        filter?: Record<string, any>;
    }): Promise<BitrixContact[]>;
    getLatestContacts(limit?: number): Promise<BitrixContact[]>;
    createDeal(deal: BitrixDeal): Promise<string>;
    getDeal(id: string): Promise<BitrixDeal>;
    updateDeal(id: string, deal: Partial<BitrixDeal>): Promise<boolean>;
    listDeals(params?: {
        start?: number;
        filter?: Record<string, any>;
        order?: Record<string, string>;
        select?: string[];
    }): Promise<BitrixDeal[]>;
    getLatestDeals(limit?: number): Promise<BitrixDeal[]>;
    getDealsFromDateRange(startDate: string, endDate?: string, limit?: number): Promise<BitrixDeal[]>;
    createLead(lead: BitrixLead): Promise<string>;
    getLead(id: string): Promise<BitrixLead>;
    updateLead(id: string, lead: Partial<BitrixLead>): Promise<boolean>;
    listLeads(params?: {
        start?: number;
        filter?: Record<string, any>;
        order?: Record<string, string>;
        select?: string[];
    }): Promise<BitrixLead[]>;
    getLatestLeads(limit?: number): Promise<BitrixLead[]>;
    getLeadsFromDateRange(startDate: string, endDate?: string, limit?: number): Promise<BitrixLead[]>;
    createCompany(company: BitrixCompany): Promise<string>;
    getCompany(id: string): Promise<BitrixCompany>;
    updateCompany(id: string, company: Partial<BitrixCompany>): Promise<boolean>;
    listCompanies(params?: {
        start?: number;
        filter?: Record<string, any>;
        order?: Record<string, string>;
        select?: string[];
    }): Promise<BitrixCompany[]>;
    getLatestCompanies(limit?: number): Promise<BitrixCompany[]>;
    getCompaniesFromDateRange(startDate: string, endDate?: string, limit?: number): Promise<BitrixCompany[]>;
    getDealPipelines(): Promise<any[]>;
    getDealStages(pipelineId?: string): Promise<any[]>;
    filterDealsByPipeline(pipelineId: string, options?: {
        limit?: number;
        orderBy?: string;
        orderDirection?: string;
        select?: string[];
    }): Promise<BitrixDeal[]>;
    filterDealsByBudget(minBudget: number, maxBudget?: number, currency?: string, options?: {
        limit?: number;
        orderBy?: string;
        orderDirection?: string;
        select?: string[];
    }): Promise<BitrixDeal[]>;
    filterDealsByStatus(stageIds: string[], pipelineId?: string, options?: {
        limit?: number;
        orderBy?: string;
        orderDirection?: string;
        select?: string[];
    }): Promise<BitrixDeal[]>;
    createTask(task: BitrixTask): Promise<string>;
    getTask(id: string): Promise<BitrixTask>;
    updateTask(id: string, task: Partial<BitrixTask>): Promise<boolean>;
    listTasks(params?: {
        select?: string[];
        filter?: Record<string, any>;
        order?: Record<string, string>;
        start?: number;
    }): Promise<BitrixTask[]>;
    getCurrentUser(): Promise<any>;
    getUser(userId: string): Promise<any>;
    getAllUsers(): Promise<any[]>;
    getUsersByIds(userIds: string[]): Promise<any[]>;
    resolveUserNames(userIds: string[]): Promise<Record<string, string>>;
    enhanceWithUserNames<T extends Record<string, any>>(items: T[], userIdFields?: string[]): Promise<T[]>;
    searchCRM(query: string, entityTypes?: string[]): Promise<any>;
    validateWebhook(): Promise<boolean>;
    diagnosePermissions(): Promise<any>;
    checkCRMSettings(): Promise<any>;
    testLeadsAPI(): Promise<any>;
    private batchRequest;
    monitorUserActivities(userId?: string, startDate?: string, endDate?: string, options?: {
        includeCallVolume?: boolean;
        includeEmailActivity?: boolean;
        includeTimelineActivity?: boolean;
        includeResponseTimes?: boolean;
    }): Promise<any>;
    getUserPerformanceSummary(userId?: string, startDate?: string, endDate?: string, options?: {
        includeDealMetrics?: boolean;
        includeActivityRatios?: boolean;
        includeConversionRates?: boolean;
    }): Promise<any>;
    analyzeAccountPerformance(accountId: string, accountType: 'company' | 'contact', startDate?: string, endDate?: string, options?: {
        includeAllInteractions?: boolean;
        includeDealProgression?: boolean;
        includeTimelineHistory?: boolean;
    }): Promise<any>;
    compareUserPerformance(userIds?: string[], startDate?: string, endDate?: string, options?: {
        metrics?: string[];
        includeRankings?: boolean;
        includeTrends?: boolean;
    }): Promise<any>;
    private calculateResponseTimes;
    private generateUserRankings;
    trackDealProgression(dealId?: string, userId?: string, pipelineId?: string, startDate?: string, endDate?: string, options?: any): Promise<any>;
    monitorSalesActivities(userId?: string, startDate?: string, endDate?: string, options?: any): Promise<any>;
    generateSalesReport(reportType: string, startDate?: string, endDate?: string, options?: any): Promise<any>;
    getTeamDashboard(options?: any): Promise<any>;
    analyzeCustomerEngagement(accountId?: string, accountType?: string, userId?: string, startDate?: string, endDate?: string, options?: any): Promise<any>;
    forecastPerformance(forecastType: string, userId?: string, options?: any): Promise<any>;
}
export declare const bitrix24Client: Bitrix24Client;
//# sourceMappingURL=client.d.ts.map