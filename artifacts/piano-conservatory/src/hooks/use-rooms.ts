import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getRoom, createRoom } from "@workspace/api-client-react";
// Since we don't have direct access to import routes here cleanly from the generated code in a custom way
// we use the generated hooks. We define simple wrappers if needed, but Orval generates them!

// The generated API client already exports `useGetRoom` and `useCreateRoom`.
// If we needed custom wrappers, we'd do it here, but we can just re-export or use them directly.
export { useGetRoom, useCreateRoom } from "@workspace/api-client-react";
