// migrations/create-pagos-abiertos-table.js
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('pagos_abiertos', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      prestamo_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'solicitudes_prestamos',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      monto: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      interes: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      capital: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      saldo_anterior: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      saldo_posterior: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false
      },
      fecha: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addColumn('solicitudes_prestamos', 'tipo_prestamo', {
      type: Sequelize.ENUM('abierto', 'cerrado'),
      defaultValue: 'cerrado'
    });

    await queryInterface.addColumn('solicitudes_prestamos', 'interes_pagado', {
      type: Sequelize.DECIMAL(10, 2),
      defaultValue: 0
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('pagos_abiertos');
    await queryInterface.removeColumn('solicitudes_prestamos', 'tipo_prestamo');
    await queryInterface.removeColumn('solicitudes_prestamos', 'interes_pagado');
  }
};