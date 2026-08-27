#include <iostream>
#include <windows.h>
#include <string>
#include <cstdlib>

typedef unsigned char CK_BYTE;
typedef unsigned long CK_ULONG;
typedef unsigned long CK_FLAGS;
typedef unsigned long CK_RV;
typedef unsigned char CK_BBOOL;
typedef CK_ULONG CK_SLOT_ID;

typedef struct CK_VERSION {
    CK_BYTE major;
    CK_BYTE minor;
} CK_VERSION;

typedef struct CK_TOKEN_INFO {
    CK_BYTE label[32];
    CK_BYTE manufacturerID[32];
    CK_BYTE model[16];
    CK_BYTE serialNumber[16];

    CK_FLAGS flags;

    CK_ULONG ulMaxSessionCount;
    CK_ULONG ulSessionCount;
    CK_ULONG ulMaxRwSessionCount;
    CK_ULONG ulRwSessionCount;
    CK_ULONG ulMaxPinLen;
    CK_ULONG ulMinPinLen;
    CK_ULONG ulTotalPublicMemory;
    CK_ULONG ulFreePublicMemory;
    CK_ULONG ulTotalPrivateMemory;
    CK_ULONG ulFreePrivateMemory;

    CK_VERSION hardwareVersion;
    CK_VERSION firmwareVersion;

    CK_BYTE utcTime[16];
} CK_TOKEN_INFO;

typedef CK_RV (__cdecl *C_INITIALIZE)(void *);
typedef CK_RV (__cdecl *C_GET_SLOT_LIST)(CK_BBOOL, CK_SLOT_ID *, CK_ULONG *);
typedef CK_RV (__cdecl *C_GET_TOKEN_INFO)(CK_SLOT_ID, CK_TOKEN_INFO *);
typedef CK_RV (__cdecl *C_FINALIZE)(void *);

int main(int argc, char *argv[])
{
    int targetSlot = (argc > 1) ? std::atoi(argv[1]) : 0;

    HMODULE hLib = LoadLibraryA("C:\\Windows\\System32\\aetpkss1.dll");
    if (!hLib)
        hLib = LoadLibraryA("C:\\Windows\\System32\\aetpkss11.dll");

    if (!hLib) {
        std::cout << "Failed to load DLL\n";
        return 1;
    }

    auto c_init = (C_INITIALIZE)GetProcAddress(hLib, "C_Initialize");
    auto c_get_slots = (C_GET_SLOT_LIST)GetProcAddress(hLib, "C_GetSlotList");
    auto c_get_token_info = (C_GET_TOKEN_INFO)GetProcAddress(hLib, "C_GetTokenInfo");
    auto c_finalize = (C_FINALIZE)GetProcAddress(hLib, "C_Finalize");

    if (!c_init || !c_get_slots || !c_get_token_info || !c_finalize) {
        std::cout << "Failed to get function pointers\n";
        FreeLibrary(hLib);
        return 1;
    }

    if (c_init(NULL) != 0) {
        std::cout << "C_Initialize failed\n";
        FreeLibrary(hLib);
        return 1;
    }

    CK_ULONG slotCount = 0;

    if (c_get_slots(0, NULL, &slotCount) != 0) {
        std::cout << "C_GetSlotList failed\n";
        c_finalize(NULL);
        FreeLibrary(hLib);
        return 1;
    }

    if ((CK_ULONG)targetSlot >= slotCount) {
        std::cout << "Invalid slot\n";
        c_finalize(NULL);
        FreeLibrary(hLib);
        return 1;
    }

    CK_SLOT_ID *slots = new CK_SLOT_ID[slotCount];

    if (c_get_slots(0, slots, &slotCount) != 0) {
        delete[] slots;
        c_finalize(NULL);
        FreeLibrary(hLib);
        return 1;
    }

    CK_TOKEN_INFO tokenInfo;

    if (c_get_token_info(slots[targetSlot], &tokenInfo) == 0) {
        std::string label((char *)tokenInfo.label, 32);
        label.erase(label.find_last_not_of(' ') + 1);
        std::cout << label << std::endl;
    }

    delete[] slots;

    c_finalize(NULL);
    FreeLibrary(hLib);

    return 0;
}  