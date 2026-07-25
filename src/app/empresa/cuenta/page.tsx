import { CuentaClient } from './CuentaClient';

export const dynamic = 'force-dynamic';

// El layout de /empresa ya valida sesión y acceso al panel empresarial.
export default function Cuenta() {
  return <CuentaClient />;
}
