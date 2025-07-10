
// Variables globales
let ultimoPagoId = <%= historialPagos.length > 0 ? historialPagos[0].id : 'null' %>;

// Función para pagar cuota específica
function pagarCuota(cuotaId, montoCuota) {
  const cuota = <%= JSON.stringify(cuotas) %>.find(c => c.id == cuotaId);
  
  if (cuota) {
    document.getElementById('cuotaId').value = cuotaId;
    document.getElementById('montoCuota').value = parseFloat(cuota.monto).toFixed(2);
    
    const infoText = `Cuota #${cuota.numero_cuota} - RD$ ${cuota.monto.toFixed(2)} - ` +
                    `Vence ${new Date(cuota.fecha_vencimiento).toLocaleDateString('es-DO')}`;
    
    document.getElementById('infoCuota').textContent = infoText;
    
    // Mostrar modal
    new bootstrap.Modal(document.getElementById('modalPagoCuota')).show();
  }
}

// Función para ver recibo de cuota
function verReciboCuota(cuotaId) {
  // Buscar el pago asociado a esta cuota en el historial
  const pago = <%= JSON.stringify(historialPagos) %>.find(p => p.cuota_id == cuotaId);
  
  if (pago) {
    window.open(`/prestamos/<%= prestamo.id %>/recibo?pago=${pago.id}`, '_blank');
  } else {
    alert('No se encontró recibo para esta cuota');
  }
}

// Función para procesar pago general
async function procesarPagoGeneral(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  
  // Validar monto mínimo
  const monto = parseFloat(formData.get('monto'));
  if (monto <= 0) {
    alert('El monto debe ser mayor que cero');
    return false;
  }
  
  // Mostrar loading
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Procesando...';
  submitBtn.disabled = true;
  
  try {
    const response = await fetch(`/prestamos/<%= prestamo.id %>/pagar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(Object.fromEntries(formData))
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Error al procesar el pago');
    }
    
    // Guardar ID del pago para posible impresión
    ultimoPagoId = data.pagoId;
    
    // Mostrar éxito
    alert('Pago registrado correctamente');
    
    // Cerrar modal
    bootstrap.Modal.getInstance(document.getElementById('modalPago')).hide();
    
    // Imprimir recibo si está marcado
    if (formData.get('imprimir_recibo') === 'on') {
      setTimeout(() => {
        window.open(`/prestamos/<%= prestamo.id %>/recibo?pago=${data.pagoId}&print=1`, '_blank');
      }, 500);
    }
    
    // Recargar después de 1 segundo
    setTimeout(() => window.location.reload(), 1000);
    
  } catch (error) {
    console.error('Error:', error);
    alert('Error: ' + error.message);
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  }
  
  return false;
}

// Función para procesar pago de cuota
async function procesarPagoCuota(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  
  // Validar monto mínimo
  const monto = parseFloat(formData.get('monto'));
  if (monto <= 0) {
    alert('El monto debe ser mayor que cero');
    return false;
  }
  
  // Mostrar loading
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Procesando...';
  submitBtn.disabled = true;
  
  try {
    const response = await fetch(`/prestamos/<%= prestamo.id %>/pagar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(Object.fromEntries(formData))
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Error al procesar el pago');
    }
    
    // Guardar ID del pago para posible impresión
    ultimoPagoId = data.pagoId;
    
    // Mostrar éxito
    alert('Pago de cuota registrado correctamente');
    
    // Cerrar modal
    bootstrap.Modal.getInstance(document.getElementById('modalPagoCuota')).hide();
    
    // Imprimir recibo
    setTimeout(() => {
      window.open(`/prestamos/<%= prestamo.id %>/recibo?pago=${data.pagoId}&print=1`, '_blank');
    }, 500);
    
    // Recargar después de 1 segundo
    setTimeout(() => window.location.reload(), 1000);
    
  } catch (error) {
    console.error('Error:', error);
    alert('Error: ' + error.message);
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  }
  
  return false;
}
// En el script de la vista
async function procesarPagoGeneral(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  const prestamoId = '<%= prestamo.id %>';
  
  // Mostrar loading
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Procesando...';
  submitBtn.disabled = true;

  try {
    const response = await fetch(`/prestamos/${prestamoId}/pagar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(Object.fromEntries(formData))
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Error al procesar pago');
    }

    // Cerrar modal
    bootstrap.Modal.getInstance(document.getElementById('modalPago')).hide();
    
    // Mostrar recibo si está marcado
    if (formData.get('imprimir_recibo') === 'on') {
      window.open(`/prestamos/${prestamoId}/recibo?pago=${data.pagoId}&print=1`, '_blank');
    }
    
    // Recargar la página para ver cambios
    setTimeout(() => window.location.reload(), 1000);
    
  } catch (error) {
    console.error('Error:', error);
    alert('Error: ' + error.message);
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  }
}
// Función para imprimir recibo térmico
async function imprimirReciboTermico(prestamoId, pagoId) {
  const btn = event.target.closest('button');
  
  try {
    // Mostrar loading
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;
    
    const response = await fetch(`/prestamos/${prestamoId}/imprimir-ticket?pago=${pagoId}`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'Error al imprimir');
    }
    
    alert('Recibo enviado a la impresora térmica');
    
  } catch (error) {
    console.error('Error al imprimir:', error);
    alert('Error: ' + (error.message || 'Error al enviar a la impresora'));
  } finally {
    // Restaurar botón
    btn.innerHTML = '<i class="fas fa-print"></i>';
    btn.disabled = false;
  }
}

// Función para imprimir último pago
function imprimirUltimoPago() {
  if (ultimoPagoId) {
    window.open(`/prestamos/<%= prestamo.id %>/recibo?pago=${ultimoPagoId}&print=1`, '_blank');
  } else {
    alert('No hay pagos recientes para imprimir');
  }
}

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', function() {
  // Inicializar tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.forEach(tooltipTriggerEl => {
    new bootstrap.Tooltip(tooltipTriggerEl);
  });
  
  // Mostrar primera pestaña activa
  const tabEl = document.querySelector('#resumen-tab');
  if (tabEl) new bootstrap.Tab(tabEl).show();
});

// Función para subir documentos
async function subirDocumento(tipo, archivo) {
  if (!archivo) return;
  
  const formData = new FormData();
  formData.append('documento', archivo);
  formData.append('tipo', tipo);
  
  try {
    const response = await fetch(`/prestamos/<%= prestamo.id %>/subir-documento`, {
      method: 'POST',
      body: formData
    });
    
    if (response.ok) {
      alert('Documento subido correctamente');
      window.location.reload();
    } else {
      throw new Error('Error al subir documento');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error al subir documento: ' + error.message);
  }
}

// Función para eliminar documentos
async function eliminarDocumento(tipo) {
  if (!confirm(`¿Estás seguro de eliminar este documento?`)) return;
  
  try {
    const response = await fetch(`/prestamos/<%= prestamo.id %>/eliminar-documento`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tipo })
    });
    
    if (response.ok) {
      alert('Documento eliminado correctamente');
      window.location.reload();
    } else {
      throw new Error('Error al eliminar documento');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error al eliminar documento: ' + error.message);
  }
}
document.addEventListener('click', (e) => {
  if (e.target.closest('.btn-pagar-cuota')) {
    const cuotaId = e.target.dataset.cuotaId;
    pagarCuota(cuotaId);
  }
});
document.addEventListener('click', (e) => {
  if (e.target.closest('.btn-pagar-cuota')) {
    const btn = e.target.closest('.btn-pagar-cuota');
    const cuotaId = btn.dataset.cuotaId;
    const monto = btn.dataset.monto;
    const numeroCuota = btn.dataset.cuotaNumero;

    // Llenar modal
    document.getElementById('cuotaId').value = cuotaId;
    document.getElementById('montoCuota').value = parseFloat(monto).toFixed(2);
    document.getElementById('infoCuota').textContent = 
      `Cuota #${numeroCuota} - RD$ ${parseFloat(monto).toFixed(2)}`;

    // Mostrar modal
    new bootstrap.Modal(document.getElementById('modalPagoCuota')).show();
  }
});
document.addEventListener('DOMContentLoaded', function() {
  // Manejar clic en botones de pago
  document.addEventListener('click', function(e) {
    if (e.target.closest('.btn-pagar-cuota')) {
      const button = e.target.closest('.btn-pagar-cuota');
      const cuotaId = button.dataset.cuotaId;
      const monto = button.dataset.monto;
      const numeroCuota = button.dataset.cuotaNumero;

      // Llenar datos en el modal
      document.getElementById('cuotaId').value = cuotaId;
      document.getElementById('montoCuota').value = parseFloat(monto).toFixed(2);
      
      // Mostrar información de la cuota
      document.getElementById('infoCuota').textContent = 
        `Cuota #${numeroCuota} - RD$ ${parseFloat(monto).toFixed(2)}`;

      // Mostrar modal
      new bootstrap.Modal(document.getElementById('modalPagoCuota')).show();
    }
  });

  // Manejar envío del formulario
  document.getElementById('formPagoCuota')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData(this);
    const prestamoId = '<%= prestamo.id %>';  // Asegúrate que esto se pase correctamente
    
    try {
      const response = await fetch(`/prestamos/${prestamoId}/pagar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(Object.fromEntries(formData))
      });
      
      if (!response.ok) {
        throw new Error('Error al procesar pago');
      }
      
      // Cerrar modal y recargar
      bootstrap.Modal.getInstance(document.getElementById('modalPagoCuota')).hide();
      setTimeout(() => location.reload(), 1000);  
      
    } catch (error) {
      console.error('Error:', error);
      alert('Error al procesar pago: ' + error.message);
    }
  });
});