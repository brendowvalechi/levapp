import { api } from "./api";

export type VerificationStatus = "pending" | "approved" | "rejected";

export type VehicleType =
  | "furgao"
  | "caminhonete"
  | "saveiro"
  | "strada"
  | "hr"
  | "caminhao_pequeno"
  | "outros";

export interface DriverProfileResponse {
  id: string;
  cnh_number: string | null;
  cnh_front_url: string | null;
  cnh_back_url: string | null;
  selfie_url: string | null;
  verification_status: VerificationStatus;
  rejection_reason: string | null;
}

export interface VerificationStatusResponse {
  status: VerificationStatus;
  is_complete: boolean;
  missing_documents: string[];
  rejection_reason: string | null;
}

export interface VehicleCreatePayload {
  type: VehicleType;
  plate: string;
  brand: string;
  model: string;
  year: number;
  capacity_kg?: number;
  color?: string;
}

export interface VehicleResponse {
  id: string;
  type: VehicleType;
  plate: string;
  brand: string;
  model: string;
  year: number;
  capacity_kg: number | null;
  color: string | null;
  crlv_url: string | null;
  is_active: boolean;
}

export const documentService = {
  uploadFile: async (
    uri: string,
    mimeType: string,
    filename: string,
    folder: "cnh" | "selfie" | "crlv" | "profile"
  ): Promise<string> => {
    const form = new FormData();
    form.append("file", { uri, type: mimeType, name: filename } as any);
    form.append("folder", folder);
    const res = await api.post<{ url: string }>("/api/v1/uploads/file", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data.url;
  },

  updateDocuments: async (payload: {
    cnh_number?: string;
    cnh_front_url?: string;
    cnh_back_url?: string;
    selfie_url?: string;
  }): Promise<DriverProfileResponse> => {
    const res = await api.patch<DriverProfileResponse>(
      "/api/v1/driver/documents",
      payload
    );
    return res.data;
  },

  getVerificationStatus: async (): Promise<VerificationStatusResponse> => {
    const res = await api.get<VerificationStatusResponse>(
      "/api/v1/driver/verification-status"
    );
    return res.data;
  },

  addVehicle: async (payload: VehicleCreatePayload): Promise<VehicleResponse> => {
    const res = await api.post<VehicleResponse>("/api/v1/users/me/vehicles", payload);
    return res.data;
  },

  listVehicles: async (): Promise<VehicleResponse[]> => {
    const res = await api.get<VehicleResponse[]>("/api/v1/users/me/vehicles");
    return res.data;
  },

  updateCrlv: async (vehicleId: string, crlvUrl: string): Promise<VehicleResponse> => {
    const res = await api.patch<VehicleResponse>(
      `/api/v1/driver/vehicles/${vehicleId}/crlv`,
      { crlv_url: crlvUrl }
    );
    return res.data;
  },
};
