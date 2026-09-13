export { createCustomer, createCustomerAddress, patchCustomer, patchCustomerAddress } from "./api/commands";
export {
  createCustomer as handleCreateCustomer,
  createCustomerAddress as handleCreateCustomerAddress,
  getCustomer as handleGetCustomer,
  listCustomers as handleListCustomers,
  patchCustomer as handlePatchCustomer,
  patchCustomerAddress as handlePatchCustomerAddress,
} from "./api/http";
export { listCustomers, loadCustomerDto } from "./api/queries";
export type { LoadCustomerResult } from "./api/queries";
export { customerInputSchema, customerSearchSchema } from "./model/customer";
export type { CustomerDTO } from "./model/customer";
