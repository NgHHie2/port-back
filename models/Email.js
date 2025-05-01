const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Email = sequelize.define(
  "Email",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
  },
  {
    tableName: "emails",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);

module.exports = Email;
