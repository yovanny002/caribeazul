    const { DataTypes } = require('sequelize');
    const bcrypt = require('bcryptjs');
    const db = require('./db');

    const User = db.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nombre: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
        notEmpty: {
            msg: 'El nombre es requerido'
        },
        len: {
            args: [2, 100],
            msg: 'El nombre debe tener entre 2 y 100 caracteres'
        }
        }
    },
    email: {
        type: DataTypes.STRING(150),
        allowNull: false,
        unique: {
        name: 'email',
        msg: 'Este email ya está registrado'
        },
        validate: {
        isEmail: {
            msg: 'Debe ser un email válido'
        },
        notEmpty: {
            msg: 'El email es requerido'
        }
        }
    },
    password: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
        notEmpty: {
            msg: 'La contraseña es requerida'
        },
        len: {
            args: [8, 255],
            msg: 'La contraseña debe tener al menos 8 caracteres'
        }
        }
    },
    rol: {
        type: DataTypes.ENUM('administrador', 'supervisor', 'gerente', 'empleado', 'cobrador', 'caja', 'servicio'),
        allowNull: false,
        defaultValue: 'empleado',
        validate: {
        isIn: {
            args: [['administrador', 'supervisor', 'gerente', 'empleado', 'cobrador', 'caja', 'servicio']],
            msg: 'Rol no válido'
        }
        }
    },
    sucursal_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null
    },
    estado: {
        type: DataTypes.ENUM('activo', 'inactivo'),
        allowNull: false,
        defaultValue: 'activo',
        validate: {
        isIn: {
            args: [['activo', 'inactivo']],
            msg: 'Estado no válido'
        }
        }
    },
    ultimo_login: {
        type: DataTypes.DATE,
        allowNull: true
    },
    intentos_login: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    reset_password_token: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    reset_password_expires: {
        type: DataTypes.DATE,
        allowNull: true
    }
    }, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    hooks: {
        beforeCreate: async (user) => {
        if (user.password) {
            const salt = await bcrypt.genSalt(12);
            user.password = await bcrypt.hash(user.password, salt);
        }
        },
        beforeUpdate: async (user) => {
        if (user.changed('password')) {
            const salt = await bcrypt.genSalt(12);
            user.password = await bcrypt.hash(user.password, salt);
        }
        }
    }
    });

    // Métodos de instancia
    User.prototype.validPassword = async function(password) {
    return await bcrypt.compare(password, this.password);
    };

    User.prototype.generateResetToken = function() {
    this.reset_password_token = require('crypto').randomBytes(20).toString('hex');
    this.reset_password_expires = Date.now() + 3600000; // 1 hora
    return this;
    };

    // Método para limpiar datos sensibles
    User.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    delete values.password;
    delete values.reset_password_token;
    delete values.reset_password_expires;
    return values;
    };

    module.exports = User;