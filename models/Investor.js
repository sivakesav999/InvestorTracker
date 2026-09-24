import mongoose from "mongoose";

const investorSchema = new mongoose.Schema(
  {
    investorCode: {
      type: String,
      unique: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    phone: {
      type: String,
      default: "",
      index: true,
    },

    address: {
      type: String,
      default: "",
    },

    investmentDate: {
      type: String,
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    scheme: {
      type: String,
      required: true,
    },

    notes: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

const Investor = mongoose.model("Investor", investorSchema);

export default Investor;
