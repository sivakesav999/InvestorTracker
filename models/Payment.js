import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
  {
    investorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Investor",
      required: true,
    },

    monthNo: {
      type: Number,
      required: true,
    },

    dueDate: {
      type: String,
      required: true,
    },

    amountDue: {
      type: Number,
      required: true,
      min: 0,
    },

    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },

    paymentDate: {
      type: String,
      default: "",
    },

    method: {
      type: String,
      enum: ["", "Cash", "UPI"],
      default: "",
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },

    // True only for the first complimentary payment
    // when investment date is after the 15th.
    isComplimentary: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

paymentSchema.index(
  {
    investorId: 1,
    monthNo: 1,
  },
  {
    unique: true,
  },
);

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;