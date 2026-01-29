import { Invoice, Order, POD } from '@/shared/types';
import { toast } from 'sonner';
import { generateInvoicePDF } from '@/shared/utils/pdfGenerator';
import { setToLocalStorage, getFromLocalStorage } from '@/shared/services/database';

/**
 * Descarga la factura en formato PDF profesional
 */
export async function handleDownloadInvoicePDF(invoice: Invoice, order: Order) {
  if (!invoice) {
    toast.error('No hay factura disponible para descargar');
    return;
  }
  
  try {
    await generateInvoicePDF(invoice, order, "TU EMPRESA");
    toast.success('Generando factura PDF...');
  } catch (error) {
    console.error('Error generando PDF:', error);
    toast.error('Error al generar el PDF de la factura');
  }
}

/**
 * Maneja la carga de una nueva imagen de POD
 */
export function handleUploadPODImage(
  invoiceId: string,
  orderId: string,
  onSuccess: () => void
) {
  // Crear input file oculto
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  
  input.onchange = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (!file) return;
    
    // Validar tipo de archivo
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor selecciona un archivo de imagen válido');
      return;
    }
    
    // Validar tamaño (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen es demasiado grande. Máximo 5MB');
      return;
    }
    
    try {
      // Convertir imagen a Base64
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Image = event.target?.result as string;
        
        // Crear nuevo POD o actualizar existente
        const pods = getFromLocalStorage('app-pods') || [];
        const existingPODIndex = pods.findIndex((p: POD) => p.invoiceId === invoiceId);
        
        if (existingPODIndex >= 0) {
          // Actualizar POD existente
          pods[existingPODIndex] = {
            ...pods[existingPODIndex],
            photoUrl: base64Image,
            deliveryDate: new Date().toISOString(),
          };
        } else {
          // Crear nuevo POD
          const newPOD: POD = {
            id: `pod-${Date.now()}`,
            orderId: orderId,
            invoiceId: invoiceId,
            deliveryDate: new Date().toISOString(),
            photoUrl: base64Image,
            isValidated: false,
            receiverName: '',
            notes: '',
            createdAt: new Date().toISOString()
          };
          pods.push(newPOD);
          
          // Actualizar la factura con el POD ID
          const invoices = getFromLocalStorage('app-invoices') || [];
          const invoiceIndex = invoices.findIndex((inv: Invoice) => inv.id === invoiceId);
          if (invoiceIndex >= 0) {
            invoices[invoiceIndex].podId = newPOD.id;
            setToLocalStorage('app-invoices', invoices);
          }
        }
        
        setToLocalStorage('app-pods', pods);
        toast.success('Imagen del POD cargada exitosamente');
        onSuccess();
      };
      
      reader.onerror = () => {
        toast.error('Error al leer el archivo de imagen');
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error cargando imagen:', error);
      toast.error('Error al cargar la imagen del POD');
    }
  };
  
  input.click();
}

/**
 * Descarga la imagen del POD
 */
export function handleDownloadPODImage(pod: POD) {
  if (!pod || !pod.photoUrl) {
    toast.error('No hay imagen de POD disponible para descargar');
    return;
  }
  
  try {
    // Si es base64, convertir a blob y descargar
    if (pod.photoUrl.startsWith('data:image')) {
      const link = document.createElement('a');
      link.href = pod.photoUrl;
      link.download = `POD_${pod.id}_${new Date().getTime()}.png`;
      link.click();
      toast.success('Imagen del POD descargada');
    } else {
      // Si es URL externa, abrir en nueva ventana
      window.open(pod.photoUrl, '_blank');
      toast.success('Abriendo imagen del POD...');
    }
  } catch (error) {
    console.error('Error descargando imagen:', error);
    toast.error('Error al descargar la imagen del POD');
  }
}
